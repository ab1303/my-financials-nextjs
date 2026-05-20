# Reimbursement Tracking — Context

## Problem

`CREDIT` transactions that the LLM classifies as `Transfer` or `Excluded` are saved with `status = EXCLUDED` and no downstream record is written. This correctly handles true inter-account transfers, but silently buries **reimbursements** — money a third party pays you back after you fronted a shared cost. 

Because the offsetting credit is excluded, expense roll-ups are overstated: a $100 dinner you split equally shows as $100 expense with no $50 offset. Users need a way to mark a credit as a reimbursement and link it to the expense category it offsets.

## Domain Dependencies

- Uses: `Transaction` model from [../hld.md](../hld.md) (added `offsetCategory` field)
- Uses: Transaction categorization and status management from domain HLD
- Uses: `MonthlyExpenseSummary` roll-up patterns from domain HLD
- Related: `transfer-reconciliation` (similar credit transaction classification)
- Related: `transaction-ledger` (UI entry point for setting reimbursement offset)

## Scope

**In scope**
- Introduce first-class `Reimbursement` category for CREDIT transactions
- Allow users to specify which expense category is being offset (e.g., "Food & Dining")
- When reimbursement is assigned, decrement `MonthlyExpenseSummary` for the offset category
- Make offset transparent: MonthlyExpenseSummary reflects net (gross − reimbursement)
- Preserve audit trail: `Transaction.category = 'Reimbursement'`, `Transaction.offsetCategory = 'Food & Dining'`
- Phase 2 (optional): Link reimbursement to specific debit transaction via `offsetTransactionId` FK

**Out of scope**
- Dashboard "Net Expense" visualization (gross / reimbursements / net breakdown)
- LLM auto-detection of reimbursements (handled by EXCLUDED_CREDIT_LABELS constant)
- Bulk reimbursement assignment
- Reclassification of CONFIRMED income to Reimbursement (requires IncomeRecord voidance)
