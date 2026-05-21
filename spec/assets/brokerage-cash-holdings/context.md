# Brokerage Cash Holdings — Feature Context

This feature extends the assets domain (see [spec/assets/hld.md](../hld.md)) to model and display idle cash balances held in brokerage accounts (e.g., Moomoo) in both AUD and USD. Currently, only stock holdings are tracked; cash is invisible in portfolio, net worth, and Zakat calculations. This omission is significant for Zakat, as cash is fully zakatable liquid wealth. The solution is to add a `BrokerageCashBalance` model (per-snapshot, per-account, per-currency) and surface cash balances throughout the UI.

**Domain context:** See [spec/assets/hld.md](../hld.md) for architecture, existing models, and prior decisions. This feature extends:
- **AD-3** (AUD-only net worth): Already extended by `snapshot-fx-rate` to support USD; this feature further extends to include cash balances in both currencies.
- **PortfolioSnapshot/StockHolding**: Adds cash as a first-class asset, not just stocks.

## Scope
| IN SCOPE                                                      | OUT OF SCOPE                        |
|---------------------------------------------------------------|-------------------------------------|
| Add `BrokerageCashBalance` model to Prisma schema             | Cash in currencies other than AUD/USD|
| Persist cash balances per snapshot/account/currency           | Editing/deleting cash after snapshot |
| Extend backend types, schema, and services to handle cash     | Zakat nisab calculation             |
| UI: Add cash entry to NewSnapshotModal                        | Cash trend chart                    |
| UI: Display cash in dashboard (currency/brokerage/summary)    |                                     |

## Schema References
- **Domain HLD:** [spec/assets/hld.md](../hld.md)
- **New Model:**

```prisma
// BrokerageCashBalance — idle cash per account per currency at snapshot time
model BrokerageCashBalance {
  id         String           @id @default(cuid())
  amount     Decimal          @db.Money
  currency   CurrencyEnumType
  accountId  String
  account    FinancialAccount @relation(fields: [accountId], references: [id])
  snapshotId String
  snapshot   PortfolioSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  createdAt  DateTime         @default(now())
  updatedAt  DateTime         @updatedAt

  @@unique([accountId, currency, snapshotId])
  @@index([snapshotId])
  @@index([accountId])
}
```

- **PortfolioSnapshot** gains:

```prisma
  cashBalances BrokerageCashBalance[]
```

## Existing Patterns to Reuse
- `StockHolding` relation pattern for per-snapshot, per-account assets
- `createStockSnapshot` transaction for snapshot creation
- `getSnapshotTotals` return shape for dashboard

## Gotchas
- **Migration:** Use `prisma db push` (not `prisma migrate dev`) due to pre-existing migration drift
- **Windows:** Stop dev server before any Prisma CLI operation to avoid file locking errors
