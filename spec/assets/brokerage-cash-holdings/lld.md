# Brokerage Cash Holdings — Low-Level Design (LLD)

## Phase Map
| Phase   | Description                                               | Files Changed                                                                 |
|---------|-----------------------------------------------------------|-------------------------------------------------------------------------------|
| Phase 1 | Add BrokerageCashBalance model to Prisma schema           | prisma/schema.prisma                                                          |
| Phase 2 | Backend: types, schema, service, dashboard logic          | src/types/stock-asset.types.ts, src/server/schema/stock-asset.schema.ts, src/server/services/stock-asset.service.ts, src/server/services/asset-dashboard.service.ts |
| Phase 3 | Modal UI: cash entry in NewSnapshotModal                  | src/app/(authorized)/assets/stocks/NewSnapshotModal.tsx                       |
| Phase 4 | Display UI: show cash in summary/dashboard                | src/app/(authorized)/assets/stocks/SummaryCards.tsx, src/app/(authorized)/assets/stocks/StockAssetsClient.tsx      |

**Phase dependencies:** 1 → 2 → (3, 4 in parallel)

---

## Phase 1 — Schema
- Add `BrokerageCashBalance` model to `prisma/schema.prisma`
- Add `cashBalances` relation to `PortfolioSnapshot`

```prisma
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

model PortfolioSnapshot {
  // ...existing fields...
  cashBalances BrokerageCashBalance[]
}
```

### TDD Test Cases
| Test Case                                 | Type   | Verifies                                      |
|-------------------------------------------|--------|-----------------------------------------------|
| Can create BrokerageCashBalance           | unit   | Model is creatable with valid fields          |
| Unique constraint on (account, currency, snapshot) | unit   | Duplicate cash balance not allowed            |
| Relation to PortfolioSnapshot works       | unit   | cashBalances relation is queryable            |

---

## Phase 2 — Backend (Types, Schema, Service, Dashboard)
- Add types: `CashBalance`, `CashBalanceSummary`
- Extend `AccountTotalSummary`, `CurrencyTotal`, `StockSnapshotTotals`
- Extend Zod schema: `cashBalances` array in `createStockSnapshotSchema`
- Service: persist cash balances, include in `getSnapshotTotals`
- Dashboard: include cash in stockTotal (AUD direct, USD converted)

### TypeScript Interfaces
```typescript
export type CashBalance = {
  accountId: string;
  currency: CurrencyEnumType;
  amount: number;
};

export type CashBalanceSummary = {
  accountId: string;
  accountName: string;
  currency: CurrencyEnumType;
  amount: number;
};

export type AccountTotalSummary = {
  // ...existing fields...
  cashBalances: CashBalanceSummary[];
};

export type CurrencyTotal = {
  // ...existing fields...
  totalCash: number;
};

export type StockSnapshotTotals = {
  // ...existing fields...
  cashBalances: CashBalanceSummary[];
};
```

### Zod Schema
```typescript
export const cashBalanceEntrySchema = object({
  accountId: z.string(),
  currency: z.nativeEnum(CurrencyEnumType),
  amount: z.coerce.number().min(0),
});

export const createStockSnapshotSchema = object({
  // ...existing fields...
  cashBalances: z.array(cashBalanceEntrySchema).optional(),
});
```

### Service Logic (persist + return)
- In `createStockSnapshot`, persist `cashBalances` after holdings
- In `getSnapshotTotals`, include cash in per-currency/account totals
- In `asset-dashboard.service.ts`, add cash to `stockTotal`:

```typescript
const cashAud = snapshot.cashBalances.filter(cb => cb.currency === 'AUD').reduce((sum, cb) => sum + Number(cb.amount), 0);
const cashUsd = snapshot.cashBalances.filter(cb => cb.currency === 'USD').reduce((sum, cb) => sum + Number(cb.amount), 0);
const stockTotal = ... + cashAud + (usdToAudRate ? cashUsd * usdToAudRate : 0);
```

### TDD Test Cases
| Test Case                                 | Type   | Verifies                                      |
|-------------------------------------------|--------|-----------------------------------------------|
| Can persist cash balances in snapshot     | unit   | Service saves cash balances                   |
| getSnapshotTotals includes cash           | unit   | Cash appears in returned totals               |
| Dashboard stockTotal includes cash        | unit   | Cash is included in net worth trend           |

---

## Phase 3 — Modal UI (NewSnapshotModal)
- Add "Cash Balances" section after holdings
- For each brokerage in holdings, show AUD and USD cash fields (optional)
- Fields: number inputs, default 0, optional

### UI Snippet
```typescript jsx
<Accordion title="Cash Balances">
  {brokerages.map(brokerage => (
    <div key={brokerage.accountId}>
      <label>AUD Cash</label>
      <input type="number" name={`cashBalances.${brokerage.accountId}.AUD`} />
      <label>USD Cash</label>
      <input type="number" name={`cashBalances.${brokerage.accountId}.USD`} />
    </div>
  ))}
</Accordion>
```

### TDD Test Cases
| Test Case                                 | Type   | Verifies                                      |
|-------------------------------------------|--------|-----------------------------------------------|
| Renders cash fields for each brokerage    | ui     | All brokerages show AUD/USD fields            |
| Submits cash balances with snapshot       | ui     | Form includes cashBalances array              |
| Optional fields default to 0              | ui     | No input = 0 cash                            |

---

## Phase 4 — Display UI (SummaryCards, StockAssetsClient)
- Show cash breakdown in summary cards (stocks, cash, total)
- Show cash balances in currency and brokerage views
- Render `CashBalancesSection` after holdings

### UI Snippet (Summary Card)
```typescript jsx
<Card>
  <div>Stocks: ${stockValue}</div>
  <div>Cash: ${cashValue}</div>
  <div>Total: ${stockValue + cashValue}</div>
</Card>
```

### TDD Test Cases
| Test Case                                 | Type   | Verifies                                      |
|-------------------------------------------|--------|-----------------------------------------------|
| Cash appears in summary cards             | ui     | Cash value shown per currency                 |
| Cash section in currency view             | ui     | Cash balances grouped by currency             |
| Cash section in brokerage view            | ui     | Cash balances grouped by brokerage            |

---

## Migration Notes
- Use `prisma db push` (not `prisma migrate dev`) to apply schema changes
- Run `prisma generate` after schema update
- **Stop dev server before running Prisma CLI on Windows**

```bash
# Migration steps
pnpm prisma db push
pnpm prisma generate
```

---

## File Inventory
| File                                                        | Purpose                                      |
|-------------------------------------------------------------|----------------------------------------------|
| prisma/schema.prisma                                        | Add BrokerageCashBalance model, relation     |
| src/types/stock-asset.types.ts                              | Add types for cash balances                  |
| src/server/schema/stock-asset.schema.ts                     | Zod schema for cashBalances                  |
| src/server/services/stock-asset.service.ts                  | Persist, return cash balances                |
| src/server/services/asset-dashboard.service.ts              | Include cash in dashboard totals             |
| src/app/(authorized)/assets/stocks/NewSnapshotModal.tsx     | UI for entering cash balances                |
| src/app/(authorized)/assets/stocks/SummaryCards.tsx         | Show cash in summary cards                   |
| src/app/(authorized)/assets/stocks/StockAssetsClient.tsx    | Render cash balances in dashboard views      |
