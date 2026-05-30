# Reimbursement Tracking — Context

## Definition

> **Reimbursement** — Transactions awaiting reimbursement or manual reconciliation.

A Reimbursement is user-assignable (not system-managed) and applies to two symmetric cases:

| Direction | Scenario | Example |
|---|---|---|
| **DEBIT** | You paid on behalf of someone else and are waiting to be paid back | Paid $100 dinner for group; owed $50 back |
| **CREDIT** | Someone paid you back for an expense you fronted | Received $50 from colleague for that dinner |

**Contrast with Transfer:** A Transfer is money moved between *your own* accounts — it nets to $0 and is excluded from all P&L. A Reimbursement involves a *third party* and should offset the relevant expense category in reports.

## Problem

Without a dedicated Reimbursement category:

- **DEBIT side**: When you pay for something you'll be reimbursed for, the full amount hits expense roll-ups — overstating your personal costs.
- **CREDIT side**: When someone pays you back, the credit is often classified as `Transfer` or `Excluded` (`status = EXCLUDED`), silently burying the offset. A $100 group dinner you split equally shows as $100 expense with no $50 reduction.

Users need a way to mark transactions as Reimbursements and, optionally, link them to the specific expense they offset.

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
