# Reimbursement Tracking — High Level Design

**Version:** 1.0
**Status:** Draft
**Feature:** Reimbursement Tracking — first-class CREDIT category with expense-offset roll-up

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

## Non-Goals (Phase 1)

- Linking a reimbursement to a specific originating `Transaction` record by FK
- Bulk-assigning reimbursements
- Dashboard "Net Expense" visualisation (Gross − Reimbursements breakdown per category)
- LLM auto-detection of reimbursements (AI continues to route them to `EXCLUDED`)
- Handling reclassification from a CONFIRMED income category to Reimbursement
  (CONFIRMED CREDIT → Reimbursement requires IncomeRecord voidance — Phase 2)

---

## 3. Architecture Decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | **Storage of `Reimbursement`** | Reserved free-text value in existing `category` field | No new enum needed; align
ns with how `Transaction.category` is already a string. A new `TransactionCategoryEnum` would require a Prisma migration 
 touching all callsites that read `category`. |
| 2 | **Offset category storage** | New nullable `offsetCategory String?` field on `Transaction` | Queryable; doesn't po
ollute `category` with composite strings. Single-column migration with no backfill. |
| 3 | **Status promotion** | `EXCLUDED → CONFIRMED` when user sets `Reimbursement`; `CONFIRMED → EXCLUDED` when user rem
moves it | Consistent with existing semantics: `CONFIRMED` = "this is real money, roll it up"; `EXCLUDED` = "ignore". A R
Reimbursement is real money — it reduces an expense. |
| 4 | **Roll-up mechanism** | `MonthlyExpenseSummary.amount` decremented for `offsetCategory` via new `applyReimbursemen
ntOffset` service function | Reuses the existing CalendarYear → ExpenseLedger → MonthlyExpenseSummary lookup chain. No ne
ew tables needed. `MonthlyExpenseSummary.amount` may go negative if reimbursed more than spent in that month; this is int
tentional and auditable. |
| 5 | **UI entry point** | Existing inline category `<select>` in `TransactionRow`, extended with a second "Offsets cate
egory" `<select>` that appears only when `Reimbursement` is selected | Zero new pages or modals. Consistent with the exis
sting category-edit pattern. |
| 6 | **"Reimbursement" option visibility** | Only shown in the category dropdown for `CREDIT && (status === EXCLUDED \|
|\| category === REIMBURSEMENT_CATEGORY)` rows | Prevents accidental re-classification of CONFIRMED income records (which
h would orphan IncomeRecord rows — handled in Phase 2). |
| 7 | **Constants file** | New `src/server/services/transactions/constants.ts` exports `REIMBURSEMENT_CATEGORY` and `EXC
CLUDED_CREDIT_LABELS` | Single source of truth imported by router, service, and client component. Avoids the magic string
g `'Reimbursement'` scattered across files. |
| 8 | **LLM-classified reimbursements** | LLM may label a credit as `'Reimbursement'`; `EXCLUDED_CREDIT_LABELS` gains th
his entry so it lands `EXCLUDED` at import | Consistent starting point for users. Phase 2 could auto-show the offset sele
ector for these rows. |

---

## 4. Data Model Changes

### `Transaction` (modified)

```prisma
model Transaction {
  // ... all existing fields ...
  offsetCategory  String?   // non-null only when category = 'Reimbursement'
}
```

No new enums. No changes to indexes (existing `@@index([userId, type, status])` covers
the Reimbursement query pattern `type=CREDIT, status=CONFIRMED, category='Reimbursement'`).

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

### `TransactionRow`

- CREDIT+EXCLUDED rows: add `"Reimbursement"` as first option in the category `<select>`
- When `localCategory === 'Reimbursement'`: render a second `<select>` labelled
  "Offsets category" populated with `expenseCategories`
- Maintain `localOffsetCategory` optimistic state (mirrors `localCategory` pattern)
- `onCategoryChange` signature extended: `(id, newCategory, offsetCategory?) => void`

### `TransactionLedgerTable`

- `handleCategoryChange` gains optional `offsetCategory` param
- Passes `offsetCategory` to `updateCategoryMutation.mutate({ id, newCategory, offsetCategory })`
- No other change to filter state, pagination, or tab structure

### `TransactionLedgerTable` — tab "excluded"

The `excluded` tab filter (`status: 'EXCLUDED'`) will now show both true transfers AND
reimbursements that the LLM pre-labelled (but user hasn't yet assigned an offset category).
This is the correct discovery surface for pending reimbursements.

---

## 6. tRPC Surface Changes

### `updateCategory` mutation (extended)

```
Input:  { id, newCategory, offsetCategory? }
Added:  Zod refinement — offsetCategory required when newCategory === 'Reimbursement'
Added:  Reimbursement promotion/demotion logic (see LLD §Phase 3)
Added:  applyReimbursementOffset / reverseReimbursementOffset side-effects
```

### `getAll` query (extended)

```
TransactionRow interface gains: offsetCategory: string | null
getAll map includes: offsetCategory: tx.offsetCategory ?? null
```

### `getFilterOptions` query — unchanged

---

## 7. Out of Scope / Future Phases

| Item | Phase |
|---|---|
| FK from `Transaction` to originating `Transaction` | Phase 2 |
| Dashboard "Net Expense" bar chart (Gross / Reimbursements / Net) | Phase 2 |
| Reclassification of CONFIRMED income → Reimbursement (requires IncomeRecord voidance) | Phase 2 |
| Bulk reimbursement assignment | Phase 2 |
| LLM auto-detection of reimbursement amount + offset category suggestion | Phase 3 |
| Reimbursement history report (who owes you, who paid you back) | Phase 3 |

---

## 8. Success Criteria

| Criterion | Verification |
|---|---|
| User can set `category = Reimbursement` on any `CREDIT && EXCLUDED` row | Manual test in Ledger → Excluded tab |      
| After setting Reimbursement + offset category, `Transaction.status` becomes`CONFIRMED` | DB row check |
| `MonthlyExpenseSummary.amount` for the offset category decrements by the reimbursement amount in the correct month | D
DB check + expense roll-up view |
| Changing away from Reimbursement reverts status to `EXCLUDED` and restores the MonthlyExpenseSummary | DB check |     
| Changing only the offset category (keeping Reimbursement) correctly reverses old and applies new | DB check |
| "Reimbursement" option does NOT appear in DEBIT category dropdowns | Unit test on `TransactionRow` |
| "Reimbursement" option does NOT appear for CONFIRMED CREDIT (income) rows | Unit test on `TransactionRow` |
| tRPC mutation rejects `newCategory = 'Reimbursement'` with no `offsetCategory` | Zod refinement unit test |
| tRPC mutation rejects `newCategory = 'Reimbursement'` on a DEBIT transaction | Mutation unit test |
