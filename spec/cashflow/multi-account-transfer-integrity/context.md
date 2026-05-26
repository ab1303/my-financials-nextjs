# Multi-Account Transfer Integrity — Context

## Problem Statement

When a user imports CSV bank statements from multiple accounts, every inter-account transfer
appears twice in the transaction ledger: as a DEBIT in the sending account and as a CREDIT in
the receiving account. Until both legs are linked as a matched transfer pair and recategorised
to `"Transfer"`, both entries flow into every downstream cashflow report — inflating expenses,
inflating income, and corrupting net cashflow.

The app is a **CSV-first system with no automatic bank sync**. This creates a second problem
absent from Plaid-connected apps: the user may never import one side of a transfer. They may
have 4 accounts but only ever import CSVs from 2. In those cases, no matching counterpart
transaction will ever exist — and the system must handle "orphaned" transfer legs gracefully
rather than waiting forever for a pair that will never arrive.

This document defines the scope, key concepts, and domain dependencies for resolving both
the double-counting problem and the partial-import orphan problem.

---

## Domain Dependencies

Relies on concepts defined in:
- [`cashflow/hld.md`](../hld.md) — `CashflowPeriod`, `ExpenseEntry`, `IncomeRecord`
- [`transactions/hld.md`](../../transactions/hld.md) — `Transaction`, `TransferMatchRule`,
  `TransferMatchJobResult`, transfer linking, status lifecycle

---

## The Two Distinct Problems

### Problem A — Double-Counting (Both Sides Imported)

Both the sending DEBIT and the receiving CREDIT are in the database. They must be:
1. Detected as a probable pair (scoring algorithm)
2. Linked via `transferLinkedTransactionId` (bidirectional)
3. Both recategorised to `"Transfer"`
4. Excluded from all expense and income aggregations

The infrastructure for this largely exists. The gaps are in **exclusion enforcement** on downstream
cashflow pages and in the **import workflow timing** (users can confirm transactions before transfer
matching resolves them).

### Problem B — Orphaned Transfer (One Side Only, or No Side)

The user imports only the sending account. The DEBIT exists; the CREDIT never will. Scenarios:

| Scenario | What exists | What will never exist |
|---|---|---|
| Only sender account imported | DEBIT (e.g. -$3,000 from CBA Savings) | No matching CREDIT |
| Only receiver account imported | CREDIT (e.g. +$3,000 in ING Savings) | No matching DEBIT |
| Both accounts, imported months apart | DEBIT from Jan; CREDIT from Mar | Match window (±5 days) already closed |
| Account deliberately never tracked | DEBIT exists | User explicitly does not track destination |

**Current behaviour**: Orphaned transfer legs are treated as ordinary DEBIT expenses or CREDIT
income. The user must manually recategorise each one to `"Transfer"` to suppress it — with no
systemic prompt to do so.

---

## The Key Conceptual Model: Tracked vs Untracked Accounts

The industry solution (YNAB / Actual Budget's "on-budget / off-budget" boundary) maps cleanly
onto this app's CSV import model:

> **A transfer between two tracked accounts is neutral** — it moves money within the user's
> financial picture and should not appear in income or expense reports.
>
> **A transfer to/from an untracked account crosses the budget boundary** — it represents money
> entering or leaving the user's financial picture, and SHOULD be counted.

"Tracked" in this context means: **the user has imported (or intends to import) CSVs from
that account**. This is surfaced as `FinancialAccount.isTracked` (new field).

| Transfer Direction | Report Effect |
|---|---|
| Tracked → Tracked (both sides imported) | **Neutral** — exclude from all reports |
| Tracked → Untracked (e.g. sending to investment account user doesn't import) | **Expense** — money left the tracked universe |
| Untracked → Tracked (e.g. receiving from an employer account not imported) | **Income** — money entered the tracked universe |
| Tracked → Tracked (one side imported, one side pending) | **Orphaned** — flag for resolution, treat as expense/income until resolved |

This model means the user's deliberate choice not to track an account is a valid financial
statement, not a data gap.

---

## Scope

### In Scope

- Enforcing `Transfer` category exclusion on the **Expense page**, **Income tab**, and
  **CategoryFilteredLedger** query paths (currently not enforced)
- Introducing `FinancialAccount.isTracked` flag and surfacing it in account settings UI
- Introducing the **Orphaned Transfer** concept: a single-sided transfer leg that has no
  counterpart and is unlikely to ever get one
- Adding a **"Resolve Orphaned Transfers"** workflow: user decides whether the orphaned leg
  is (a) a real expense/income or (b) a single-sided transfer (excluded from reports)
- Adding an **"Unresolved Transfers" warning banner** to the Expense and Income pages
- Adding **bank account filters** to the Expense and Income pages (parity with Bank Interest page)
- Adding **Calendar Year type toggle** (FY / Annual) to Expense and Income pages (parity with
  Donations and Bank Interest pages)
- Improving **CSV Review Step** in the import wizard to warn on probable transfer rows before
  the user confirms them
- Widening the **inter-bank date tolerance** from ±5 days to ±10 days for cross-institution transfers

### Out of Scope

- Real-time bank sync (Plaid, Basiq) — CSV import only
- Automatic fiscal year locking
- Split transactions (one leg is partially a transfer, partially an expense)
- Foreign currency / FX rate transfers
- Credit card payment reconciliation (credit cards not modelled as FinancialAccount)
- Automatic orphan resolution without user confirmation

---

## Affected Pages

| Page | Current Risk | Change Required |
|---|---|---|
| **Expense** | 🔴 Transfer DEBITs inflate monthly summaries | Transfer exclusion + bank filter + year toggle |
| **Income** (ledger tab) | 🔴 Transfer CREDITs inflate income totals | Transfer exclusion in income tab query |
| **Transaction Ledger** | 🟡 Confirming before transfer match | Pre-confirm warning on probable transfer rows |
| **CSV Import Wizard** | 🟡 No transfer-likelihood signal at review step | Add confidence chip + warn before confirm |
| **Bank Interest** | 🟢 Already scoped to Interest category | No change |
| **Donations** | 🟢 Requires explicit DonationPayment link | No change |

---

## Success Criteria

1. After a CSV import from one account only, transfer DEBITs do not appear in the Expense
   page totals unless the user explicitly resolves them as real expenses.
2. After a CSV import from one account only, transfer CREDITs do not appear in the Income
   totals unless the user explicitly resolves them as real income.
3. When both sides of a transfer are imported and linked, neither leg appears in income
   or expense aggregations on any cashflow page.
4. A user who deliberately does not track an account can mark outbound transfers to that
   account as "Expense (leaving tracked universe)" and they will be counted correctly.
5. Users are warned at the point of CSV review if rows appear to be probable transfers,
   before those rows are confirmed.

---

## Implementation Roadmap

> Full spec index with dependency graph: [`lld.md`](./lld.md)

| Priority | Sub-Feature | When |
|---|---|---|
| 🔴 **P0 — Critical, do first** | `fix-transfer-exclusion` — stop Transfer category leaking into expense/income totals | Immediately. No schema changes. Fixes live data integrity bug. |
| 🟠 **P1 — High, after P0** | `handle-orphans` — surface unmatched transfers as warnings; let user resolve them | Phase 2 (banner) ships after P0. Phase 3 (schema + UI) follows. |
| 🟡 **P2 — Medium, parallel** | `add-filtration-parity` — bank filter + year toggle on Expense/Income pages | Fully independent. Run in parallel with handle-orphans. |
| 🟡 **P2 — Medium, parallel** | `harden-import-wizard` — transfer likelihood warnings in CSV Review step | Fully independent. Run in parallel with handle-orphans. |
| 🔵 **P3 — Low, last** | `improve-detection` — widen cross-bank date tolerance; respect isTracked in scoring | Requires handle-orphans Phase 3 (isTracked field) to be in DB first. |
