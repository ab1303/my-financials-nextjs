# Assets Domain — High Level Design

## Problem Statement

The app's Asset section consists of disconnected detail pages: Bank Assets (cash snapshots) and Stock Assets (portfolio snapshots). Users must visit each page separately and mentally combine the numbers to understand their total wealth position. There is no trend view, no combined total, and no answer to "are my assets growing?". For the Zakat use case, total assets at a specific date are required for obligation calculation but cannot currently be derived from the app. The goal is a unified Assets domain: snapshot-based, point-in-time, multi-account, multi-calendar-lens, with a net worth dashboard that aggregates cash and stocks into a single trend line.

---

## Shared Data Models

### `BankBalanceSnapshot`

```prisma
model BankBalanceSnapshot {
  id             String               @id @default(cuid())
  snapshotDate   DateTime
  userId         String
  user           User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  balanceRecords BankBalanceRecord[]
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt

  @@index([userId, snapshotDate])
}

model BankBalanceRecord {
  id          String              @id @default(cuid())
  balance     Decimal             @db.Money
  accountId   String
  account     BankAccount         @relation(fields: [accountId], references: [id])
  snapshotId  String
  snapshot    BankBalanceSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt

  @@unique([accountId, snapshotId])
  @@index([snapshotId])
}
```

### `PortfolioSnapshot`

```prisma
model PortfolioSnapshot {
  id           String         @id @default(cuid())
  snapshotDate DateTime
  userId       String
  user         User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  holdings     StockHolding[]
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  @@index([userId, snapshotDate])
}

model StockHolding {
  id           String            @id @default(cuid())
  ticker       String
  companyName  String
  quantity     Decimal
  buyPrice     Decimal
  buyDate      DateTime
  currentPrice Decimal
  currency     CurrencyEnumType  // AUD | USD
  accountId    String
  account      Business          @relation(fields: [accountId], references: [id])
  snapshotId   String
  snapshot     PortfolioSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  // Optional sale fields:
  salePrice      Decimal?
  saleDate       DateTime?
  soldQuantity   Decimal?
  plannedTerm    PlannedTermEnum?
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt
}
```

### `NetWorthDataPoint` (TypeScript only — not persisted)

```typescript
interface NetWorthDataPoint {
  date:            string;    // snapshotDate from BankBalanceSnapshot (ISO)
  cashTotal:       number;    // sum of BankBalanceRecord.balance
  stockTotal:      number;    // sum from nearest PortfolioSnapshot on or before date (AUD only)
  netWorthTotal:   number;    // cashTotal + stockTotal
  cashSnapshotId:  string;
  stockSnapshotId: string | null;
}
```

---

## Architecture Decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | **No schema changes for net worth** | `BankBalanceSnapshot` and `PortfolioSnapshot` remain independent; aggregation at read time | Snapshot frequency differs per asset class; forcing unified snapshot events adds friction |
| 2 | **Last Known Value strategy** | Each `BankBalanceSnapshot` date is an anchor; stock value = most recent `PortfolioSnapshot` on or before that date | Standard approach used by Empower, Wealthica, Sharesight; no synchronised snapshot dates required |
| 3 | **AUD-only net worth total** | `stockTotal` sums only `StockHolding` where `currency = AUD` | No currency conversion in scope; including USD at stale rate produces misleading number |
| 4 | **Snapshot-based, manual entry** | No Basiq/bank API integration in scope | Manual quarterly snapshots are the user's stated preference; Basiq is a clean Phase 3 addition |
| 5 | **Calendar lens as secondary filter** | Dashboard defaults to ALL snapshots; lens is an analytical tool | Primary mental model is wealth tracking over time, not compliance reporting |
| 6 | **Snapshot date is immutable** | Cannot edit snapshot date after creation | Snapshot date is its identity; editing corrupts financial history and fiscal year boundary integrity |

---

## Data Model Reference

Canonical table specs live in [`architecture/DataModel/banking/`](../../../architecture/DataModel/banking/) and [`architecture/DataModel/portfolio/`](../../../architecture/DataModel/portfolio/):

| Table | Domain | Description |
|-------|--------|-------------|
| [FinancialAccount](../../../architecture/DataModel/banking/FinancialAccount.md) | Banking | User bank or brokerage account |
| [BankBalanceSnapshot](../../../architecture/DataModel/banking/BankBalanceSnapshot.md) | Banking | Point-in-time balance snapshot header |
| [BankBalanceRecord](../../../architecture/DataModel/banking/BankBalanceRecord.md) | Banking | Per-account balance at one snapshot date |
| [PortfolioSnapshot](../../../architecture/DataModel/portfolio/PortfolioSnapshot.md) | Portfolio | Point-in-time portfolio snapshot header |
| [StockHolding](../../../architecture/DataModel/portfolio/StockHolding.md) | Portfolio | Individual stock position within a snapshot |
| [BrokerageCashBalance](../../../architecture/DataModel/portfolio/BrokerageCashBalance.md) | Portfolio | Idle brokerage cash by account, currency, and snapshot |

---

## Out of Scope

| Item | Reason |
|---|---|
| Real-time bank API sync (Basiq) | 2–4 week separate integration |
| Property / superannuation manual tracking | New asset class; new model required |
| USD-to-AUD conversion for combined total | Requires FX rate feed or manual rate entry |
| Dividend tracking | Links to Income ledger (source=STOCKS); separate feature |
| Real-time price feeds | Manual entry of current price per holding |
| Zakat Nisab calculation on dashboard | Requires Nisab threshold input and obligation logic |
| Net worth export (CSV / PDF) | Reporting feature; post-MVP |
