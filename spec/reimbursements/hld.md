# Reimbursement Tracking — High Level Design

**Version:** 1.1
**Status:** Phase 1 Complete — Phase 2 Specced
**Feature:** Reimbursement Tracking — first-class CREDIT category with expense-offset roll-up, optional transaction-to-transaction link, and accordion ledger view

---

## 1. Problem Statement

The app currently classifies all non-income CREDIT transactions as `EXCLUDED`. This is
correct for inter-account transfers but wrong for **reimbursements** — a credit where
someone pays you back for an expense you originally covered. Excluding these credits means:

- Expense totals for the period are overstated
- There is no auditable link between the incoming reimbursement and the expense category it offsets
- Users have no in-app mechanism to distinguish "transfer I don't care about" from
  "money I'm owed back for a real expense"

---

## 2. Goals

- Introduce a first-class `Reimbursement` category for CREDIT transactions that the user
  can assign via the existing inline category editor
- When a reimbursement is assigned, reduce the `MonthlyExpenseSummary` for the nominated
  offset expense category in the same month
- Allow the user to specify which expense category is being offset (e.g. "Food & Dining")
- Make the roll-up transparent: the MonthlyExpenseSummary reflects the net amount
  (gross expense minus reimbursement), not the gross
- Preserve a clean audit trail: the `Transaction` record carries both `category = 'Reimbursement'`
  and `offsetCategory = 'Food & Dining'`

## Non-Goals (Phase 1 — Complete)

- Linking a reimbursement to a specific originating `Transaction` record by FK
- Bulk-assigning reimbursements
- Dashboard "Net Expense" visualisation (Gross − Reimbursements breakdown per category)
- LLM auto-detection of reimbursements (AI continues to route them to `EXCLUDED`)
- Handling reclassification from a CONFIRMED income category to Reimbursement
  (CONFIRMED CREDIT → Reimbursement requires IncomeRecord voidance — future)

---

## 2b. Phase 2 Goals

Phase 1 established the category-offset mechanism (MonthlyExpenseSummary decrement). Phase 2
adds an optional **transaction-to-transaction link**: the user can pin a reimbursement CREDIT
to the specific DEBIT transaction it offsets.

- Add `offsetTransactionId` nullable FK on `Transaction` (self-referential)
- The FK is **optional** — category-offset continues to work without it
- When linked, the DEBIT row in the Expenses ledger gains an expandable accordion showing
  its linked reimbursements beneath it
- Net amount indicator on DEBIT rows: original amount + `(net $XX.XX after reimbursements)`
- CREDIT Reimbursement rows gain an optional "Link to expense" combobox (searchable by
  description or category) that fires the link in a single interaction
- A new `searchDebitTransactions` tRPC query powers the combobox without a new page/modal

---

## 3. Architecture Decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | **Storage of `Reimbursement`** | Reserved free-text value in existing `category` field | No new enum needed; aligns with how `Transaction.category` is already a string. A new `TransactionCategoryEnum` would require a Prisma migration touching all callsites that read `category`. |
| 2 | **Offset category storage** | New nullable `offsetCategory String?` field on `Transaction` | Queryable; doesn't pollute `category` with composite strings. Single-column migration with no backfill. |
| 3 | **Status promotion** | `EXCLUDED → CONFIRMED` when user sets `Reimbursement`; `CONFIRMED → EXCLUDED` when user removes it | Consistent with existing semantics: `CONFIRMED` = "this is real money, roll it up"; `EXCLUDED` = "ignore". A Reimbursement is real money — it reduces an expense. |
| 4 | **Roll-up mechanism** | `MonthlyExpenseSummary.amount` decremented for `offsetCategory` via new `applyReimbursementOffset` service function | Reuses the existing CalendarYear → ExpenseLedger → MonthlyExpenseSummary lookup chain. No new tables needed. `MonthlyExpenseSummary.amount` may go negative if reimbursed more than spent in that month; this is intentional and auditable. |
| 5 | **UI entry point** | Existing inline category `<select>` in `TransactionRow`, extended with a second "Offsets category" `<select>` that appears only when `Reimbursement` is selected | Zero new pages or modals. Consistent with the existing category-edit pattern. |
| 6 | **"Reimbursement" option visibility** | Only shown in the category dropdown for `CREDIT && (status === EXCLUDED \|\| category === REIMBURSEMENT_CATEGORY)` rows | Prevents accidental re-classification of CONFIRMED income records (which would orphan IncomeRecord rows). |
| 7 | **Constants file** | New `src/server/services/transactions/constants.ts` exports `REIMBURSEMENT_CATEGORY` and `EXCLUDED_CREDIT_LABELS` | Single source of truth imported by router, service, and client component. Avoids the magic string `'Reimbursement'` scattered across files. |
| 8 | **LLM-classified reimbursements** | LLM may label a credit as `'Reimbursement'`; `EXCLUDED_CREDIT_LABELS` gains this entry so it lands `EXCLUDED` at import | Consistent starting point for users. |
| 9 | **offsetTransactionId is optional** | The FK link to the original DEBIT is never required; the category-offset roll-up fires regardless of whether the link is set | Avoids forcing users to find the original DEBIT (which may be in a prior import period or a different bank account). The link is a precision enhancement, not a gate. |
| 10 | **Accordion display** | DEBIT rows with linked reimbursements render a `<ReimbursementSubRow>` beneath them when expanded; `TransactionRow` returns a `React.Fragment` to allow multiple `<tr>` elements | Keeps the flat table structure intact. No separate "linked expenses" page or modal required. `ReimbursementSubRow` is a presentation-only component — it receives data as props, fires no mutations. |
| 11 | **Transaction search endpoint** | New `searchDebitTransactions` tRPC query (DEBIT+CONFIRMED, full-text on description/category) used by the "Link to expense" combobox inside `TransactionRow` | Avoids re-using the paginated `getAll` for a search-as-you-type picker. Small, scoped query with a `limit: 10` cap. `TransactionRow` is a Client Component — it may call tRPC queries lazily (only when picker is open). |

---

## 4. Data Model Changes

### `Transaction` (Phase 1 — complete)

```prisma
model Transaction {
  // ... all existing fields ...
  offsetCategory  String?   // non-null only when category = 'Reimbursement'
}
```

### `Transaction` (Phase 2 — self-referential FK)

```prisma
model Transaction {
  // ... all existing fields including offsetCategory ...
  offsetTransactionId String?
  offsetTransaction   Transaction?   @relation("ReimbursementLink", fields: [offsetTransactionId], references: [id])
  reimbursements      Transaction[]  @relation("ReimbursementLink")
}
```

`offsetTransactionId` points at the DEBIT transaction that this CREDIT reimbursement offsets.
It is **always null for DEBIT transactions**. It is optional even for Reimbursement CREDITs —
the user may choose not to link.

The self-referential relation is named `"ReimbursementLink"` to avoid collision with any
future self-referential relation on `Transaction`.

No additional indexes needed — reimbursements are fetched via `include` on the parent DEBIT
row query, which is already indexed by `userId`.

### Roll-up tables (read + write, no schema change)

```
MonthlyExpenseSummary.amount
  Semantics today : POSITIVE = total expense for the month in that category
  Semantics after : POSITIVE = net (gross − reimbursements); CAN go negative
```

The change is behavioural, not structural. Existing queries that sum `amount` will
automatically reflect net values once reimbursements are applied.

---

## 5. Component Changes (High Level)

### `TransactionRow` (Phase 1 — complete)

- CREDIT+EXCLUDED rows: add `"Reimbursement"` as first option in the category `<select>`
- When `localCategory === 'Reimbursement'`: render a second `<select>` labelled
  "Offsets category" populated with `expenseCategories`
- Maintain `localOffsetCategory` optimistic state (mirrors `localCategory` pattern)
- `onCategoryChange` signature extended: `(id, newCategory, offsetCategory?) => void`

### `TransactionRow` (Phase 2 additions)

- Returns `React.Fragment` instead of a bare `<tr>` to allow sub-row rendering
- **DEBIT rows** with `transaction.reimbursements.length > 0`:
  - Chevron expand/collapse button in the first cell
  - Net amount label beneath the gross amount: `(net $XX.XX)`
  - When expanded: renders one `<ReimbursementSubRow>` per linked reimbursement
- **CREDIT Reimbursement rows**: optional "Link to expense" section below the offset select
  - A collapsed "＋ Link to original expense" toggle
  - When open: a search-as-you-type combobox powered by `searchDebitTransactions`
  - Selecting a DEBIT transaction calls `onCategoryChange(id, 'Reimbursement', offsetCategory, selectedId)`
  - When already linked: shows linked transaction description with an ✕ unlink button
- `onCategoryChange` signature further extended: `(id, newCategory, offsetCategory?, offsetTransactionId?) => void`

### `ReimbursementSubRow` (Phase 2 — new component)

- `src/components/transactions/ReimbursementSubRow.tsx`
- Presentation-only; receives `reimbursement: LedgerTransactionRow` and `colCount: number`
- Renders an indented `<tr>` with teal background and `↩` prefix
- Shows: date, description (truncated), amount (teal), "offsets {offsetCategory}"
- No mutations, no callbacks — display only

### `TransactionLedgerTable` (Phase 1 — complete)

- `handleCategoryChange` gains optional `offsetCategory` param
- Passes `offsetCategory` to `updateCategoryMutation.mutate({ id, newCategory, offsetCategory })`

### `TransactionLedgerTable` (Phase 2 additions)

- `handleCategoryChange` further extended: `(id, newCategory, offsetCategory?, offsetTransactionId?) => void`
- Passes `offsetTransactionId` to `updateCategoryMutation.mutate({ ..., offsetTransactionId })`

---

## 6. tRPC Surface Changes

### `updateCategory` mutation (Phase 1 — complete)

```
Input:  { id, newCategory, offsetCategory? }
Added:  Zod refinement — offsetCategory required when newCategory === 'Reimbursement'
Added:  Reimbursement promotion/demotion logic (see LLD §Phase 3)
Added:  applyReimbursementOffset / reverseReimbursementOffset side-effects
```

### `updateCategory` mutation (Phase 2 additions)

```
Input:  { id, newCategory, offsetCategory?, offsetTransactionId? }
Added:  Validate offsetTransactionId is DEBIT+CONFIRMED and belongs to user (when provided)
Added:  Write/clear offsetTransactionId alongside category and offsetCategory
```

### `getAll` query (Phase 1 — complete)

```
TransactionRow interface gains: offsetCategory: string | null
getAll map includes: offsetCategory: tx.offsetCategory ?? null
```

### `getAll` query (Phase 2 additions)

```
PrismaTransaction gains:   offsetTransactionId: string | null
                           reimbursements: Array<sub-transaction shape>
TransactionRow gains:      offsetTransactionId: string | null
                           reimbursements: TransactionRow[]  ([] for CREDIT/unlinked rows)
findMany include gains:    reimbursements: { where: { category: REIMBURSEMENT_CATEGORY }, select: { ... } }
```

### `searchDebitTransactions` query (Phase 2 — new)

```
Input:  { search?: string, limit?: number (default 10, max 20) }
Output: Array<{ id, date, description, amount, category }>
Scope:  DEBIT + CONFIRMED + userId scoped
Use:    Powers the "Link to expense" combobox in TransactionRow
```

### `getFilterOptions` query — unchanged

---

## 7. Out of Scope / Future Phases

| Item | Phase |
|---|---|
| Dashboard "Net Expense" bar chart (Gross / Reimbursements / Net) | Future |
| Reclassification of CONFIRMED income → Reimbursement (requires IncomeRecord voidance) | Future |
| Bulk reimbursement assignment | Future |
| LLM auto-detection of reimbursement amount + offset category suggestion | Future |
| Reimbursement history report (who owes you, who paid you back) | Future |

---

## 8. Success Criteria

### Phase 1 (complete)

| Criterion | Verification |
|---|---|
| User can set `category = Reimbursement` on any `CREDIT && EXCLUDED` row | Manual test in Ledger → Excluded tab |
| After setting Reimbursement + offset category, `Transaction.status` becomes `CONFIRMED` | DB row check |
| `MonthlyExpenseSummary.amount` for the offset category decrements by the reimbursement amount in the correct month | DB check + expense roll-up view |
| Changing away from Reimbursement reverts status to `EXCLUDED` and restores the MonthlyExpenseSummary | DB check |
| Changing only the offset category (keeping Reimbursement) correctly reverses old and applies new | DB check |
| "Reimbursement" option does NOT appear in DEBIT category dropdowns | Unit test on `TransactionRow` |
| "Reimbursement" option does NOT appear for CONFIRMED CREDIT (income) rows | Unit test on `TransactionRow` |
| tRPC mutation rejects `newCategory = 'Reimbursement'` with no `offsetCategory` | Zod refinement unit test |
| tRPC mutation rejects `newCategory = 'Reimbursement'` on a DEBIT transaction | Mutation unit test |
| Promoted Reimbursement row is visible in "Reimbursements" tab with teal ↩ badge | Manual test |

### Phase 2

| Criterion | Verification |
|---|---|
| User can optionally link a Reimbursement CREDIT to a specific DEBIT via "Link to expense" combobox | Manual test |
| `searchDebitTransactions` returns only DEBIT+CONFIRMED rows for the authenticated user | Unit test |
| `updateCategory` rejects `offsetTransactionId` that refers to a CREDIT or EXCLUDED transaction | Mutation unit test |
| `updateCategory` rejects `offsetTransactionId` that belongs to a different user | Mutation unit test |
| DEBIT row with a linked reimbursement shows a chevron and net amount in the Expenses tab | Manual test |
| Expanding the accordion reveals the `ReimbursementSubRow` with correct description and amount | Manual test |
| Removing Reimbursement (demotion) clears `offsetTransactionId` on the DB row | DB check |
| Linking then unlinking a reimbursement leaves `MonthlyExpenseSummary` unchanged (net zero) | DB check |
| `pnpm run build` passes after Phase 2 implementation | CI |
