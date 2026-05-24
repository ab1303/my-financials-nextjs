# Data Model — Architecture Overview

> Table specs are organised by domain. Each domain folder is a self-contained vertical slice
> that can be handed to a subagent without loading unrelated schema context.

---

## Domains

| Domain | Folder | Tables | Description |
|--------|--------|--------|-------------|
| Auth | [auth/](auth/) | Account, Session, User, VerificationToken | NextAuth identity and session infrastructure. `User` is the ownership root for all user-scoped data. |
| Core | [core/](core/) | Business, CalendarYear, Individual, RelationshipType | Shared reference entities — parties (people & orgs) and the reporting-period dimension used across all ledgers. |
| Income | [income/](income/) | IncomeSource, IncomeLedger, IncomeRecord | Per-user income tracking grouped by reporting period and source type. |
| Expenses | [expenses/](expenses/) | ExpenseCategory, SpecialCategory, ExpenseLedger, MonthlyExpenseSummary | Aggregated monthly expense tracking by category and fiscal period. |
| Banking | [banking/](banking/) | FinancialAccount, BankBalanceSnapshot, BankBalanceRecord | User bank accounts and point-in-time balance snapshots. |
| Portfolio | [portfolio/](portfolio/) | PortfolioSnapshot, StockHolding, BrokerageCashBalance | Investment portfolio snapshots — stock positions and idle brokerage cash. |
| Philanthropy | [philanthropy/](philanthropy/) | ZakatObligation, ZakatPayment, DonationLedger, DonationPayment, BankInterestLiability, ~~BankInterestPayment~~ | Zakat obligations, voluntary donations, and interest-cleansing payments. |
| Import / AI | [import-ai/](import-ai/) | ImportSession, ImportImage, AIUsageLog, MerchantCategoryMap | File import lifecycle, AI token audit, and learned merchant→category mappings. |
| Transactions | [transactions/](transactions/) | Transaction, TransferMatchRule, TransferMatchJobResult | Central staging table for imported transactions and transfer-matching infrastructure. |
| System | [system/](system/) | _prisma_migrations | Prisma-managed migration history (not application-owned). |

---

## Drift / Schema Health

| Table | Status | Finding |
|-------|--------|---------|
| `BankInterestPayment` | ⚠️ **Deprecated** | Schema comment marks it deprecated — rows migrated to `DonationPayment(INTEREST_CLEANSING)`. Active code drift: tRPC router, service, controller, schema, UI pages, and cleanup script still reference it. Cleanup required before the model can be dropped. |
| `SpecialCategory` | 🟡 **Orphaned** | No FK relationships to any other model. Used only as a UI lookup in Settings and a tRPC router. Intentionally low-coupled; not deprecated, but not integrated into the relational model. |

---

## Key Cross-Domain Relationships

- **`User`** (auth) owns or scopes nearly every row in the application — ledgers, accounts, snapshots, transactions, import sessions.
- **`CalendarYear`** (core) is the shared reporting-period dimension referenced by `IncomeLedger`, `ExpenseLedger`, `DonationLedger`, `ZakatObligation`, and `BankInterestLiability`.
- **`FinancialAccount`** (banking) is the account dimension for `BankBalanceRecord`, `StockHolding`, `BrokerageCashBalance`, and `Transaction`.
- **`Transaction`** (transactions) is the central fact table — `IncomeRecord`, `DonationPayment`, and `ZakatPayment` each optionally link back to a confirmed transaction.
- **`ImportSession`** (import-ai) is the import lifecycle parent for `ImportImage`, `AIUsageLog`, `Transaction`, and `TransferMatchJobResult`.
