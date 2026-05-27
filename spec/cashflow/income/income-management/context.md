# Income Management — Context

## Problem
Users need a reliable way to record, review, and maintain recurring and ad-hoc income so their cash position stays accurate across monthly and fiscal-year views. Income can come from two sources: (1) imported bank transactions marked as CREDIT, and (2) manually-entered income records.

## Domain Dependencies

- Uses `CashflowPeriod`, `IncomeSource` (vocabulary), and `CashflowSnapshot` from [`../../hld.md`](../../hld.md).
- **All income data lives in the `Transaction` table** with `type=CREDIT` and a `source` discriminator (BANK / LLM_CLASSIFIED / MANUAL).
- `IncomeRecord` and `IncomeLedger` are **deprecated** — see [`../income-source-of-truth/context.md`](../income-source-of-truth/context.md) for the migration plan.
- Shares reporting boundaries with expense tracking for net cashflow calculations.
- Must remain compatible with interest-cleansing and audit features that inspect the wider cashflow surface.

## Scope

**In scope:**
- Querying income from the `Transaction` ledger (type=CREDIT, status=CONFIRMED).
- Creating manual income entries as `Transaction(type=CREDIT, source=MANUAL)` records.
- Editing and deleting only manually-created income entries; imported income is read-only.
- Fiscal-year and date-scoped filtering for income review.
- Income totals aggregated from all CREDIT transactions that feed downstream cashflow summaries.

**Out of scope:**
- Advanced table ergonomics and batch workflows owned by the income UX feature.
- Expense or donation workflows.
- Bank-ledger-derived interest handling.
- Bank transaction import or categorization (owned by the Transactions domain).