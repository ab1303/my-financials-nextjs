# Low Level Design: Assets Stocks Tracking

## Document Info

- **Version**: 1.0
- **Date**: 2026-02-28
- **Status**: Draft
- **Based on**: [assets-stocks-tracking-prd.md](assets-stocks-tracking-prd.md) v1.1
- **Reference Implementation**: Bank Assets Cash Tracking (`/cashflow/bank`)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database Schema](#2-database-schema)
3. [API Design (tRPC Router)](#3-api-design-trpc-router)
4. [Validation Schemas (Zod)](#4-validation-schemas-zod)
5. [Service Layer](#5-service-layer)
6. [Controller Layer](#6-controller-layer)
7. [Type Definitions](#7-type-definitions)
8. [UI Component Design](#8-ui-component-design)
9. [State Management & Data Flow](#9-state-management--data-flow)
10. [Calculation Logic](#10-calculation-logic)
11. [Implementation Phases](#11-implementation-phases)
12. [Migration Strategy](#12-migration-strategy)

---

## 1. Architecture Overview

### 1.1 System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                FRONTEND                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  Page: app/(authorized)/cashflow/stocks/page.tsx  [Server Component]    │ │
│  │  ┌────────────────┐  ┌───────────────┐  ┌───────────────────────────┐  │ │
│  │  │ Fiscal Year    │  │ Summary Cards │  │ Account Accordions        │  │ │
│  │  │ Selector       │  │ (AUD / USD)   │  │ (Collapse/Expand)         │  │ │
│  │  └────────────────┘  └───────────────┘  └───────────────────────────┘  │ │
│  │                                                                         │ │
│  │  Client Component: StockAssetsClient.tsx                                │ │
│  │  ┌────────────────────────────────────────────────────────────┐         │ │
│  │  │ tRPC Client Hooks                                          │         │ │
│  │  │ trpc.stockAsset.[endpoint].useQuery | useMutation          │         │ │
│  │  │                                                            │         │ │
│  │  │ ┌──────────────────┐  ┌──────────────────────────────┐    │         │ │
│  │  │ │ NewSnapshotModal │  │ HoldingFormModal              │    │         │ │
│  │  │ │ (Create + Prefill)│  │ (Add/Edit individual holding) │    │         │ │
│  │  │ └──────────────────┘  └──────────────────────────────┘    │         │ │
│  │  └────────────────────────────────────────────────────────────┘         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ HTTP (tRPC)
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                                BACKEND                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  tRPC Router: src/server/trpc/router/stock-asset.ts                     │ │
│  │  ┌──────────────────────┐  ┌─────────────────────┐  ┌───────────────┐ │ │
│  │  │  Queries (4)         │  │  Mutations (4)      │  │ Protected by  │ │ │
│  │  │  - getSnapshots      │  │  - createSnapshot   │  │ NextAuth      │ │ │
│  │  │  - getMostRecent     │  │  - createHolding    │  │               │ │ │
│  │  │  - getSnapshotById   │  │  - updateHolding    │  │ User Context  │ │ │
│  │  │  - getSnapshotTotals │  │  - deleteHolding    │  │ Injected      │ │ │
│  │  │                      │  │  - deleteSnapshot   │  │               │ │ │
│  │  └──────────────────────┘  └─────────────────────┘  └───────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                     │                                         │
│                                     ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  Controller: src/server/controllers/stock-asset.controller.ts           │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │  │  - Extract userId from session                                   │  │ │
│  │  │  - Validate inputs (Zod schemas)                                 │  │ │
│  │  │  - Call service layer                                            │  │ │
│  │  │  - Handle errors with handleCaughtError()                        │  │ │
│  │  │  - Format responses                                              │  │ │
│  │  └──────────────────────────────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                     │                                         │
│                                     ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  Validation: src/server/schema/stock-asset.schema.ts                    │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │  │  Zod Schemas:                                                    │  │ │
│  │  │  - createStockSnapshotSchema                                     │  │ │
│  │  │  - createStockHoldingSchema                                      │  │ │
│  │  │  - updateStockHoldingSchema                                      │  │ │
│  │  │  - deleteHoldingSchema / deleteSnapshotSchema                    │  │ │
│  │  │  - getSnapshotsSchema / getSnapshotByIdSchema                    │  │ │
│  │  └──────────────────────────────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                     │                                         │
│                                     ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  Service: src/server/services/stock-asset.service.ts                    │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │  │  Snapshot Operations:                                            │  │ │
│  │  │  - createStockSnapshot()       [Transaction]                     │  │ │
│  │  │  - getStockSnapshots()         [Date-range filter]               │  │ │
│  │  │  - getMostRecentSnapshot()                                       │  │ │
│  │  │  - getSnapshotById()                                             │  │ │
│  │  │  - getSnapshotTotals()         [Aggregation by account/currency] │  │ │
│  │  │  - deleteStockSnapshot()                                         │  │ │
│  │  │                                                                  │  │ │
│  │  │  Holding Operations:                                             │  │ │
│  │  │  - createStockHolding()                                          │  │ │
│  │  │  - updateStockHolding()                                          │  │ │
│  │  │  - deleteStockHolding()                                          │  │ │
│  │  │                                                                  │  │ │
│  │  │  🔐 All operations filter by userId                              │  │ │
│  │  └──────────────────────────────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                     │                                         │
│                                     ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  Prisma Client (ORM)                                                    │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ SQL Queries
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          DATABASE (PostgreSQL)                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                                                                         │ │
│  │  ┌──────────────┐       ┌──────────────────────────┐                   │ │
│  │  │  User        │       │  Business                │                   │ │
│  │  │  ──────────  │       │  (type=BROKERAGE)        │                   │ │
│  │  │  - id        │       │  ────────────────────    │                   │ │
│  │  │  - email     │◄──┐   │  - id                    │                   │ │
│  │  │  - name      │   │   │  - name                  │                   │ │
│  │  └──────────────┘   │   │  - type                  │                   │ │
│  │         ▲            │   │  - userId ───────────────┼──┘                │ │
│  │         │            │   └──────────────────────────┘                   │ │
│  │         │            │              ▲                                    │ │
│  │  ┌──────┴──────────────┐            │                                    │ │
│  │  │  StockSnapshot      │            │                                    │ │
│  │  │  ─────────────────  │            │                                    │ │
│  │  │  - id               │            │                                    │ │
│  │  │  - snapshotDate     │            │ accountId                          │ │
│  │  │  - userId ──────────┼────┘       │                                    │ │
│  │  └─────────────────────┘            │                                    │ │
│  │         ▲                            │                                    │ │
│  │         │ snapshotId                 │                                    │ │
│  │  ┌──────┴──────────────────────────┐│                                    │ │
│  │  │  StockHolding                    ││                                    │ │
│  │  │  ──────────────────────────────  ││                                    │ │
│  │  │  - id                            ││                                    │ │
│  │  │  - ticker           String       ││                                    │ │
│  │  │  - companyName      String       ││                                    │ │
│  │  │  - quantity         Decimal(12,6)││                                    │ │
│  │  │  - buyPrice         @db.Money    ││                                    │ │
│  │  │  - buyDate          DateTime     ││                                    │ │
│  │  │  - currentPrice     @db.Money    ││                                    │ │
│  │  │  - currency         Enum(AUD/USD)││                                    │ │
│  │  │  - plannedTerm      Enum         ││                                    │ │
│  │  │  - salePrice?       @db.Money    ││                                    │ │
│  │  │  - saleDate?        DateTime     ││                                    │ │
│  │  │  - soldQuantity?    Decimal(12,6)││                                    │ │
│  │  │  - accountId ───────────────────┘│                                    │ │
│  │  │  - snapshotId ──────────────────┘                                    │ │
│  │  └─────────────────────────────────┘                                    │ │
│  │                                                                         │ │
│  │  Indexes:                                                               │ │
│  │  - StockSnapshot: [userId, snapshotDate]                                │ │
│  │  - StockHolding: [snapshotId], [accountId], [ticker]                    │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Key Design Decisions

| Decision              | Choice                     | Rationale                                                   |
| --------------------- | -------------------------- | ----------------------------------------------------------- |
| Snapshot filtering    | Date-range (no calendarId) | Matches bank-assets pattern; avoids tight coupling          |
| Quantity type         | `Decimal(12,6)`            | Supports fractional shares (Commbank Pocket, Stake)         |
| Partial sale tracking | `soldQuantity` field       | Preserves original purchase quantity for audit              |
| Price storage         | `@db.Money`                | Consistent with bank-assets, PostgreSQL money type          |
| API structure         | Single `stockAsset` router | Consistent with `bankAsset` router pattern                  |
| UI route              | `/cashflow/stocks`         | Consistent with `/cashflow/bank` under Asset(s) nav group   |
| State management      | tRPC + React Query         | Consistent with all other features; no Redux/Context needed |
| Accordion component   | Headless UI `Disclosure`   | Matches existing bank-assets and sidebar patterns           |

### 1.3 Technology Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **State Management**: tRPC + React Query (via `@trpc/react-query`)
- **Backend**: tRPC, Next.js API Routes
- **Validation**: Zod
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Auth**: NextAuth.js
- **Date Library**: date-fns (holding period calculations)
- **UI Components**: Headless UI (Disclosure), react-select, react-number-format, react-icons

---

## 2. Database Schema

### 2.1 New Enums

```prisma
// Add BROKERAGE to existing enum
enum BusinessEnumType {
  BANK
  PHILANTHROPY
  BROKERAGE       // NEW - for stock brokerage accounts
}

// New enums
enum InvestmentTermEnumType {
  SHORT_TERM      // < 12 months
  MID_TERM        // 12-36 months
  LONG_TERM       // > 36 months
}

enum CurrencyEnumType {
  AUD
  USD
}
```

### 2.2 New Models

```prisma
model StockSnapshot {
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
  id             String                @id @default(cuid())
  ticker         String                // "CBA.AX", "AAPL", etc.
  companyName    String                // "Commonwealth Bank", "Apple Inc"
  quantity       Decimal               @db.Decimal(12, 6)
  buyPrice       Decimal               @db.Money
  buyDate        DateTime
  currentPrice   Decimal               @db.Money
  currency       CurrencyEnumType
  plannedTerm    InvestmentTermEnumType

  // Sale fields (null when holding is unsold)
  salePrice      Decimal?              @db.Money
  saleDate       DateTime?
  soldQuantity   Decimal?              @db.Decimal(12, 6)

  // Relations
  accountId      String
  account        Business              @relation(fields: [accountId], references: [id])
  snapshotId     String
  snapshot       StockSnapshot         @relation(fields: [snapshotId], references: [id], onDelete: Cascade)

  createdAt      DateTime              @default(now())
  updatedAt      DateTime              @updatedAt

  @@index([snapshotId])
  @@index([accountId])
  @@index([ticker])
}
```

### 2.3 Model Relation Updates

```prisma
// User model - add:
StockSnapshot   StockSnapshot[]

// Business model - add:
StockHolding    StockHolding[]
```

### 2.4 Design Notes

- **No `calendarId`**: StockSnapshot uses date-range filtering via CalendarYear's `fromYear/fromMonth/toYear/toMonth`, same as bank-assets. No direct FK to CalendarYear.
- **No unique constraint on holdings**: Unlike BankAssetEntry (which has `@@unique([accountId, snapshotId])`), a user can hold the same stock multiple times at different buy prices (tax lot tracking). Each purchase is a separate holding row.
- **`soldQuantity` vs modifying `quantity`**: When a partial sale occurs, `quantity` stays as the original purchase amount, and `soldQuantity` records how many were sold. This preserves the full audit trail. `remainingShares = quantity - (soldQuantity ?? 0)`.
- **Cascade delete**: Deleting a StockSnapshot cascades to all StockHolding records.
- **No cascade from Business**: If a brokerage Business is deleted, holdings are NOT cascaded (Prisma will throw FK constraint error). Historical data must be preserved. UI should prevent deletion of brokerage accounts that have holdings.

---

## 3. API Design (tRPC Router)

### 3.1 Router File: `src/server/trpc/router/stock-asset.ts`

```typescript
import { router, protectedProcedure } from '@/server/trpc/trpc';
import {
  createSnapshotHandler,
  getSnapshotsHandler,
  getMostRecentSnapshotHandler,
  getSnapshotByIdHandler,
  getSnapshotTotalsHandler,
  deleteSnapshotHandler,
  createHoldingHandler,
  updateHoldingHandler,
  deleteHoldingHandler,
} from '@/server/controllers/stock-asset.controller';
import {
  createStockSnapshotSchema,
  getSnapshotsSchema,
  getSnapshotByIdSchema,
  deleteSnapshotSchema,
  createStockHoldingSchema,
  updateStockHoldingSchema,
  deleteHoldingSchema,
} from '@/server/schema/stock-asset.schema';

export const stockAssetRouter = router({
  // Snapshot queries
  getSnapshots: protectedProcedure
    .input(getSnapshotsSchema)
    .query(({ input, ctx: { session } }) =>
      getSnapshotsHandler({ input, userId: session.user.id }),
    ),

  getMostRecentSnapshot: protectedProcedure
    .input(getSnapshotsSchema)
    .query(({ input, ctx: { session } }) =>
      getMostRecentSnapshotHandler({ input, userId: session.user.id }),
    ),

  getSnapshotById: protectedProcedure
    .input(getSnapshotByIdSchema)
    .query(({ input, ctx: { session } }) =>
      getSnapshotByIdHandler({ input, userId: session.user.id }),
    ),

  getSnapshotTotals: protectedProcedure
    .input(getSnapshotByIdSchema)
    .query(({ input, ctx: { session } }) =>
      getSnapshotTotalsHandler({ input, userId: session.user.id }),
    ),

  // Snapshot mutations
  createSnapshot: protectedProcedure
    .input(createStockSnapshotSchema)
    .mutation(({ input, ctx: { session } }) =>
      createSnapshotHandler({ input, userId: session.user.id }),
    ),

  deleteSnapshot: protectedProcedure
    .input(deleteSnapshotSchema)
    .mutation(({ input, ctx: { session } }) =>
      deleteSnapshotHandler({ input, userId: session.user.id }),
    ),

  // Holding mutations
  createHolding: protectedProcedure
    .input(createStockHoldingSchema)
    .mutation(({ input, ctx: { session } }) =>
      createHoldingHandler({ input, userId: session.user.id }),
    ),

  updateHolding: protectedProcedure
    .input(updateStockHoldingSchema)
    .mutation(({ input, ctx: { session } }) =>
      updateHoldingHandler({ input, userId: session.user.id }),
    ),

  deleteHolding: protectedProcedure
    .input(deleteHoldingSchema)
    .mutation(({ input, ctx: { session } }) =>
      deleteHoldingHandler({ input, userId: session.user.id }),
    ),
});
```

### 3.2 Router Registration

Add to `src/server/trpc/router/_app.ts`:

```typescript
import { stockAssetRouter } from './stock-asset';

export const appRouter = router({
  // ... existing routers
  stockAsset: stockAssetRouter,
});
```

### 3.3 Endpoint Detail

| Endpoint                | Input                                | Returns                             | Notes                                           |
| ----------------------- | ------------------------------------ | ----------------------------------- | ----------------------------------------------- |
| `getSnapshots`          | `{ calendarYearId?, calendarType? }` | `StockSnapshotWithHoldings[]`       | Filters by date range derived from CalendarYear |
| `getMostRecentSnapshot` | `{ calendarYearId?, calendarType? }` | `StockSnapshotWithHoldings \| null` | Latest snapshot within date range               |
| `getSnapshotById`       | `{ snapshotId }`                     | `StockSnapshotWithHoldings`         | Full snapshot with all holdings + account info  |
| `getSnapshotTotals`     | `{ snapshotId }`                     | `StockSnapshotTotals`               | Aggregated by account and currency              |
| `createSnapshot`        | `{ snapshotDate, holdings[] }`       | `StockSnapshotWithHoldings`         | Transactional creation                          |
| `deleteSnapshot`        | `{ snapshotId }`                     | `{ success: true }`                 | Cascades to holdings                            |
| `createHolding`         | `{ snapshotId, ...holdingFields }`   | `StockHoldingWithAccount`           | Add to existing snapshot                        |
| `updateHolding`         | `{ holdingId, ...updatableFields }`  | `StockHoldingWithAccount`           | Update prices, sale info, etc.                  |
| `deleteHolding`         | `{ holdingId }`                      | `{ success: true }`                 | Remove from snapshot                            |

---

## 4. Validation Schemas (Zod)

### 4.1 File: `src/server/schema/stock-asset.schema.ts`

```typescript
import { object, string, z, array } from 'zod';

// Enum validations
const currencyEnum = z.enum(['AUD', 'USD']);
const investmentTermEnum = z.enum(['SHORT_TERM', 'MID_TERM', 'LONG_TERM']);

// Single holding schema (used in snapshot creation)
export const stockHoldingEntrySchema = object({
  ticker: string({ required_error: 'Ticker symbol is required' })
    .min(1, 'Ticker symbol is required')
    .max(20, 'Ticker must be less than 20 characters'),
  companyName: string({ required_error: 'Company name is required' })
    .min(1, 'Company name is required')
    .max(200, 'Company name must be less than 200 characters'),
  quantity: z
    .number({ required_error: 'Quantity is required' })
    .positive('Quantity must be greater than 0'),
  buyPrice: z
    .number({ required_error: 'Buy price is required' })
    .positive('Buy price must be greater than 0'),
  buyDate: z.coerce.date({ required_error: 'Buy date is required' }),
  currentPrice: z
    .number({ required_error: 'Current price is required' })
    .nonnegative('Current price must be >= 0'),
  currency: currencyEnum,
  plannedTerm: investmentTermEnum,
  accountId: string({ required_error: 'Account (brokerage) is required' }),

  // Optional sale fields
  salePrice: z
    .number()
    .positive('Sale price must be > 0')
    .optional()
    .nullable(),
  saleDate: z.coerce.date().optional().nullable(),
  soldQuantity: z
    .number()
    .positive('Sold quantity must be > 0')
    .optional()
    .nullable(),
})
  .refine(
    (data) => {
      // If any sale field is provided, all three must be provided
      const hasSalePrice = data.salePrice != null;
      const hasSaleDate = data.saleDate != null;
      const hasSoldQty = data.soldQuantity != null;
      if (hasSalePrice || hasSaleDate || hasSoldQty) {
        return hasSalePrice && hasSaleDate && hasSoldQty;
      }
      return true;
    },
    {
      message:
        'Sale price, sale date, and sold quantity must all be provided together',
    },
  )
  .refine(
    (data) => {
      // soldQuantity must not exceed quantity
      if (data.soldQuantity != null) {
        return data.soldQuantity <= data.quantity;
      }
      return true;
    },
    { message: 'Sold quantity cannot exceed total quantity' },
  );

// Create snapshot with multiple holdings
export const createStockSnapshotSchema = object({
  snapshotDate: z.coerce.date({ required_error: 'Snapshot date is required' }),
  holdings: array(stockHoldingEntrySchema).min(
    1,
    'At least one holding is required',
  ),
});

// Create a single holding (add to existing snapshot)
export const createStockHoldingSchema = object({
  snapshotId: string({ required_error: 'Snapshot ID is required' }),
}).merge(stockHoldingEntrySchema);

// Update an existing holding
export const updateStockHoldingSchema = object({
  holdingId: string({ required_error: 'Holding ID is required' }),
  ticker: string().min(1).max(20).optional(),
  companyName: string().min(1).max(200).optional(),
  quantity: z.number().positive().optional(),
  buyPrice: z.number().positive().optional(),
  buyDate: z.coerce.date().optional(),
  currentPrice: z.number().nonnegative().optional(),
  currency: currencyEnum.optional(),
  plannedTerm: investmentTermEnum.optional(),
  salePrice: z.number().positive().optional().nullable(),
  saleDate: z.coerce.date().optional().nullable(),
  soldQuantity: z.number().positive().optional().nullable(),
});

// Delete schemas
export const deleteSnapshotSchema = object({
  snapshotId: string({ required_error: 'Snapshot ID is required' }),
});

export const deleteHoldingSchema = object({
  holdingId: string({ required_error: 'Holding ID is required' }),
});

// Query schemas
export const getSnapshotsSchema = object({
  calendarYearId: string().optional(),
  calendarType: z.enum(['FISCAL', 'ANNUAL', 'ZAKAT']).optional(),
});

export const getSnapshotByIdSchema = object({
  snapshotId: string({ required_error: 'Snapshot ID is required' }),
});

// Export inferred types
export type StockHoldingEntryInput = z.infer<typeof stockHoldingEntrySchema>;
export type CreateStockSnapshotInput = z.infer<
  typeof createStockSnapshotSchema
>;
export type CreateStockHoldingInput = z.infer<typeof createStockHoldingSchema>;
export type UpdateStockHoldingInput = z.infer<typeof updateStockHoldingSchema>;
export type DeleteSnapshotInput = z.infer<typeof deleteSnapshotSchema>;
export type DeleteHoldingInput = z.infer<typeof deleteHoldingSchema>;
export type GetSnapshotsInput = z.infer<typeof getSnapshotsSchema>;
export type GetSnapshotByIdInput = z.infer<typeof getSnapshotByIdSchema>;
```

### 4.2 Validation Rules Summary

| Field           | Type    | Validation                               |
| --------------- | ------- | ---------------------------------------- |
| `ticker`        | String  | Required, 1-20 chars                     |
| `companyName`   | String  | Required, 1-200 chars                    |
| `quantity`      | Number  | Required, > 0                            |
| `buyPrice`      | Number  | Required, > 0                            |
| `buyDate`       | Date    | Required, coerced                        |
| `currentPrice`  | Number  | Required, ≥ 0                            |
| `currency`      | Enum    | Required, AUD or USD                     |
| `plannedTerm`   | Enum    | Required, SHORT/MID/LONG                 |
| `salePrice`     | Number? | Optional, > 0 if provided                |
| `saleDate`      | Date?   | Optional, required if salePrice provided |
| `soldQuantity`  | Number? | Optional, > 0, ≤ quantity if provided    |
| **Cross-field** |         | Sale fields are all-or-nothing           |

---

## 5. Service Layer

### 5.1 File: `src/server/services/stock-asset.service.ts`

All functions are user-scoped (filter by `userId` parameter).

### 5.2 Function Signatures

```typescript
// ── Snapshot Operations ──────────────────────────────────────────────

/**
 * Create a stock snapshot with all holdings in a transaction.
 * Verifies all referenced accountIds (Business type=BROKERAGE) belong to user.
 */
export async function createStockSnapshot(
  userId: string,
  snapshotDate: Date,
  holdings: StockHoldingEntryInput[],
): Promise<StockSnapshotWithHoldings>;

/**
 * Get all snapshots within a date range, ordered by snapshotDate DESC.
 * Date range derived from CalendarYear by calendarYearId or calendarType.
 */
export async function getStockSnapshots(
  userId: string,
  filters?: { calendarYearId?: string; fromDate?: Date; toDate?: Date },
): Promise<StockSnapshotWithHoldings[]>;

/**
 * Get the most recent snapshot within filters (for prefill + initial display).
 */
export async function getMostRecentSnapshot(
  userId: string,
  filters?: { calendarYearId?: string; fromDate?: Date; toDate?: Date },
): Promise<StockSnapshotWithHoldings | null>;

/**
 * Get a single snapshot by ID (user-scoped).
 */
export async function getSnapshotById(
  snapshotId: string,
  userId: string,
): Promise<StockSnapshotWithHoldings | null>;

/**
 * Calculate aggregated totals for a snapshot:
 * - Group holdings by account
 * - Calculate per-holding: marketValue, unrealizedPL, realizedPL
 * - Sum per account, then per currency for grand totals
 */
export async function getSnapshotTotals(
  snapshotId: string,
  userId: string,
): Promise<StockSnapshotTotals>;

/**
 * Delete a snapshot and all holdings (cascade).
 */
export async function deleteStockSnapshot(
  snapshotId: string,
  userId: string,
): Promise<void>;

// ── Holding Operations ───────────────────────────────────────────────

/**
 * Add a single holding to an existing snapshot.
 * Verifies snapshot and account belong to user.
 */
export async function createStockHolding(
  userId: string,
  input: CreateStockHoldingInput,
): Promise<StockHoldingWithAccount>;

/**
 * Update an existing holding's fields.
 * Verifies holding's snapshot belongs to user.
 */
export async function updateStockHolding(
  userId: string,
  input: UpdateStockHoldingInput,
): Promise<StockHoldingWithAccount>;

/**
 * Delete a holding from a snapshot.
 * Verifies holding's snapshot belongs to user.
 */
export async function deleteStockHolding(
  holdingId: string,
  userId: string,
): Promise<void>;
```

### 5.3 Key Implementation Details

#### Snapshot Creation (Transaction)

```typescript
export async function createStockSnapshot(userId, snapshotDate, holdings) {
  return await prisma.$transaction(async (tx) => {
    // 1. Verify all accounts belong to user and are type=BROKERAGE
    const accountIds = [...new Set(holdings.map((h) => h.accountId))];
    const accounts = await tx.business.findMany({
      where: {
        id: { in: accountIds },
        userId,
        type: 'BROKERAGE',
      },
    });

    if (accounts.length !== accountIds.length) {
      throw new Error(
        'One or more brokerage accounts not found or do not belong to user',
      );
    }

    // 2. Create snapshot with nested holdings
    const snapshot = await tx.stockSnapshot.create({
      data: {
        snapshotDate,
        userId,
        holdings: {
          create: holdings.map((h) => ({
            ticker: h.ticker.toUpperCase(),
            companyName: h.companyName,
            quantity: h.quantity,
            buyPrice: h.buyPrice,
            buyDate: h.buyDate,
            currentPrice: h.currentPrice,
            currency: h.currency,
            plannedTerm: h.plannedTerm,
            salePrice: h.salePrice ?? null,
            saleDate: h.saleDate ?? null,
            soldQuantity: h.soldQuantity ?? null,
            accountId: h.accountId,
          })),
        },
      },
      include: {
        holdings: {
          include: { account: true },
          orderBy: { ticker: 'asc' },
        },
      },
    });

    return snapshot;
  });
}
```

#### Snapshot Totals (Aggregation)

```typescript
export async function getSnapshotTotals(snapshotId, userId) {
  const snapshot = await getSnapshotById(snapshotId, userId);
  if (!snapshot) throw new Error('Snapshot not found');

  // Group holdings by account
  const accountGroups = new Map<
    string,
    {
      accountId: string;
      accountName: string;
      currency: CurrencyEnumType;
      holdings: StockHoldingWithAccount[];
    }
  >();

  for (const holding of snapshot.holdings) {
    const key = holding.accountId;
    if (!accountGroups.has(key)) {
      accountGroups.set(key, {
        accountId: holding.accountId,
        accountName: holding.account.name,
        currency: holding.currency,
        holdings: [],
      });
    }
    accountGroups.get(key)!.holdings.push(holding);
  }

  // Calculate per-account totals
  const accounts = Array.from(accountGroups.values()).map((group) => {
    let totalMarketValue = 0;
    let totalUnrealizedPL = 0;
    let totalRealizedPL = 0;

    for (const h of group.holdings) {
      const qty = Number(h.quantity);
      const soldQty = h.soldQuantity ? Number(h.soldQuantity) : 0;
      const remainingQty = qty - soldQty;
      const buyPrice = Number(h.buyPrice);
      const currentPrice = Number(h.currentPrice);

      // Market value of remaining shares
      const marketValue = remainingQty * currentPrice;
      totalMarketValue += marketValue;

      // Unrealized P/L on remaining shares
      if (remainingQty > 0) {
        totalUnrealizedPL += (currentPrice - buyPrice) * remainingQty;
      }

      // Realized P/L on sold shares
      if (soldQty > 0 && h.salePrice) {
        totalRealizedPL += (Number(h.salePrice) - buyPrice) * soldQty;
      }
    }

    return {
      ...group,
      totalMarketValue,
      totalUnrealizedPL,
      totalRealizedPL,
    };
  });

  // Grand totals by currency
  const currencyTotals = new Map<string, CurrencyTotal>();
  for (const acct of accounts) {
    const key = acct.currency;
    if (!currencyTotals.has(key)) {
      currencyTotals.set(key, {
        currency: key,
        totalMarketValue: 0,
        totalUnrealizedPL: 0,
        totalRealizedPL: 0,
      });
    }
    const ct = currencyTotals.get(key)!;
    ct.totalMarketValue += acct.totalMarketValue;
    ct.totalUnrealizedPL += acct.totalUnrealizedPL;
    ct.totalRealizedPL += acct.totalRealizedPL;
  }

  return {
    snapshotId: snapshot.id,
    snapshotDate: snapshot.snapshotDate,
    accounts,
    currencyTotals: Array.from(currencyTotals.values()),
  };
}
```

#### Date-Range Filtering (matches bank-assets pattern)

```typescript
// In the controller layer, resolve calendarYearId to date range:
async function resolveDateRange(
  calendarYearId?: string,
  calendarType?: string,
) {
  if (!calendarYearId && !calendarType) return {};

  const where: any = {};
  if (calendarYearId) where.id = calendarYearId;
  if (calendarType) where.type = calendarType;

  const calendarYear = await prisma.calendarYear.findFirst({
    where,
    orderBy: { fromYear: 'desc' },
  });

  if (!calendarYear) return {};

  return {
    fromDate: new Date(calendarYear.fromYear, calendarYear.fromMonth - 1, 1),
    toDate: new Date(calendarYear.toYear, calendarYear.toMonth - 1 + 1, 0), // last day of toMonth
  };
}
```

---

## 6. Controller Layer

### 6.1 File: `src/server/controllers/stock-asset.controller.ts`

Controllers follow the bank-assets pattern: extract userId, call service, wrap in try/catch with `handleCaughtError()`.

```typescript
import { handleCaughtError } from '@/server/utils/errors';
import * as stockAssetService from '@/server/services/stock-asset.service';
import type {
  CreateStockSnapshotInput,
  GetSnapshotsInput,
  GetSnapshotByIdInput,
  DeleteSnapshotInput,
  CreateStockHoldingInput,
  UpdateStockHoldingInput,
  DeleteHoldingInput,
} from '@/server/schema/stock-asset.schema';

// ── Snapshot Handlers ─────────────────────────────────────────────

export async function getSnapshotsHandler({
  input,
  userId,
}: {
  input: GetSnapshotsInput;
  userId: string;
}) {
  try {
    const dateRange = await resolveDateRange(
      input.calendarYearId,
      input.calendarType,
    );
    return await stockAssetService.getStockSnapshots(userId, dateRange);
  } catch (error) {
    handleCaughtError(error);
  }
}

export async function getMostRecentSnapshotHandler({
  input,
  userId,
}: {
  input: GetSnapshotsInput;
  userId: string;
}) {
  try {
    const dateRange = await resolveDateRange(
      input.calendarYearId,
      input.calendarType,
    );
    return await stockAssetService.getMostRecentSnapshot(userId, dateRange);
  } catch (error) {
    handleCaughtError(error);
  }
}

export async function getSnapshotByIdHandler({
  input,
  userId,
}: {
  input: GetSnapshotByIdInput;
  userId: string;
}) {
  try {
    return await stockAssetService.getSnapshotById(input.snapshotId, userId);
  } catch (error) {
    handleCaughtError(error);
  }
}

export async function getSnapshotTotalsHandler({
  input,
  userId,
}: {
  input: GetSnapshotByIdInput;
  userId: string;
}) {
  try {
    return await stockAssetService.getSnapshotTotals(input.snapshotId, userId);
  } catch (error) {
    handleCaughtError(error);
  }
}

export async function createSnapshotHandler({
  input,
  userId,
}: {
  input: CreateStockSnapshotInput;
  userId: string;
}) {
  try {
    return await stockAssetService.createStockSnapshot(
      userId,
      input.snapshotDate,
      input.holdings,
    );
  } catch (error) {
    handleCaughtError(error);
  }
}

export async function deleteSnapshotHandler({
  input,
  userId,
}: {
  input: DeleteSnapshotInput;
  userId: string;
}) {
  try {
    await stockAssetService.deleteStockSnapshot(input.snapshotId, userId);
    return { success: true as const };
  } catch (error) {
    handleCaughtError(error);
  }
}

// ── Holding Handlers ──────────────────────────────────────────────

export async function createHoldingHandler({
  input,
  userId,
}: {
  input: CreateStockHoldingInput;
  userId: string;
}) {
  try {
    return await stockAssetService.createStockHolding(userId, input);
  } catch (error) {
    handleCaughtError(error);
  }
}

export async function updateHoldingHandler({
  input,
  userId,
}: {
  input: UpdateStockHoldingInput;
  userId: string;
}) {
  try {
    return await stockAssetService.updateStockHolding(userId, input);
  } catch (error) {
    handleCaughtError(error);
  }
}

export async function deleteHoldingHandler({
  input,
  userId,
}: {
  input: DeleteHoldingInput;
  userId: string;
}) {
  try {
    await stockAssetService.deleteStockHolding(input.holdingId, userId);
    return { success: true as const };
  } catch (error) {
    handleCaughtError(error);
  }
}
```

---

## 7. Type Definitions

### 7.1 File: `src/types/stock-asset.types.ts`

```typescript
import type {
  StockSnapshot,
  StockHolding,
  Business,
  CurrencyEnumType,
  InvestmentTermEnumType,
} from '@prisma/client';

// ── Extended Prisma Types (with relations) ───────────────────────

export type StockHoldingWithAccount = StockHolding & {
  account: Pick<Business, 'id' | 'name'>;
};

export type StockSnapshotWithHoldings = StockSnapshot & {
  holdings: StockHoldingWithAccount[];
};

// ── Computed/Display Types ───────────────────────────────────────

export type HoldingCalculations = {
  remainingQuantity: number; // quantity - (soldQuantity ?? 0)
  costBasis: number; // buyPrice × quantity
  marketValue: number; // currentPrice × remainingQuantity
  unrealizedPL: number; // (currentPrice - buyPrice) × remainingQuantity
  unrealizedPLPercent: number; // unrealizedPL / (buyPrice × remainingQuantity) × 100
  realizedPL: number; // (salePrice - buyPrice) × soldQuantity (if sold)
  holdingPeriodMonths: number; // months from buyDate to snapshotDate/saleDate
  isCGTEligible: boolean; // holdingPeriodMonths >= 12 (at saleDate)
  isSold: boolean; // soldQuantity > 0
  isFullySold: boolean; // soldQuantity === quantity
  termStatus: TermStatus; // ON_TRACK | AHEAD | BEHIND
};

export type TermStatus = 'ON_TRACK' | 'AHEAD' | 'BEHIND';

export type HoldingDisplay = StockHoldingWithAccount & HoldingCalculations;

// ── Aggregated Types ─────────────────────────────────────────────

export type AccountTotalSummary = {
  accountId: string;
  accountName: string;
  currency: CurrencyEnumType;
  holdings: HoldingDisplay[];
  totalMarketValue: number;
  totalUnrealizedPL: number;
  totalRealizedPL: number;
};

export type CurrencyTotal = {
  currency: CurrencyEnumType;
  totalMarketValue: number;
  totalUnrealizedPL: number;
  totalRealizedPL: number;
};

export type StockSnapshotTotals = {
  snapshotId: string;
  snapshotDate: Date;
  accounts: AccountTotalSummary[];
  currencyTotals: CurrencyTotal[];
};

// ── Form Types ───────────────────────────────────────────────────

export type HoldingFormData = {
  ticker: string;
  companyName: string;
  quantity: number;
  buyPrice: number;
  buyDate: Date;
  currentPrice: number;
  currency: CurrencyEnumType;
  plannedTerm: InvestmentTermEnumType;
  accountId: string;
  salePrice?: number | null;
  saleDate?: Date | null;
  soldQuantity?: number | null;
};

export type SnapshotFormData = {
  snapshotDate: Date;
  holdings: HoldingFormData[];
};

// ── Select Options ───────────────────────────────────────────────

export type BrokerageAccountOption = {
  value: string; // Business.id
  label: string; // Business.name
};

export type CurrencyOption = {
  value: CurrencyEnumType;
  label: string;
};

export type InvestmentTermOption = {
  value: InvestmentTermEnumType;
  label: string;
};

// ── Calendar Year (shared, re-exported for convenience) ──────────

export type CalendarType = 'FISCAL' | 'ANNUAL' | 'ZAKAT';
```

---

## 8. UI Component Design

### 8.1 File Structure

```
src/app/(authorized)/cashflow/stocks/
├── page.tsx                    # Server Component
├── StockAssetsClient.tsx       # Client Component - main interactive shell
├── NewSnapshotModal.tsx        # Modal: create snapshot with prefill
├── HoldingFormModal.tsx        # Modal: add/edit single holding
├── SummaryCards.tsx            # Currency summary cards (AUD/USD)
└── _types.ts                   # Feature-specific types (re-exports from types/)
```

### 8.2 Server Component: `page.tsx`

```tsx
// Server Component - fetches initial data, renders client component
// Pattern: identical to cashflow/bank/page.tsx

import { getServerAuthSession } from '@/server/auth';
import { redirect } from 'next/navigation';
import StockAssetsClient from './StockAssetsClient';

export const metadata = { title: 'Stock Assets - My Financials' };

export default async function StockAssetsPage() {
  const session = await getServerAuthSession();
  if (!session) redirect('/');

  return (
    <div className='p-6'>
      <StockAssetsClient />
    </div>
  );
}
```

### 8.3 Client Component: `StockAssetsClient.tsx`

**Responsibilities**:

- Fiscal year selector (CalendarYear type=FISCAL dropdown)
- Snapshot date selector (dropdown of snapshot dates)
- Summary cards rendering (AUD/USD totals)
- Account accordion display (Headless UI Disclosure)
- Holdings table within each accordion
- New Snapshot / Edit / Delete actions
- tRPC query/mutation hooks

**State Management** (via tRPC + React Query + local useState):

```typescript
// Local state
const [selectedCalendarYearId, setSelectedCalendarYearId] = useState<
  string | null
>(null);
const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(
  null,
);
const [isNewSnapshotOpen, setIsNewSnapshotOpen] = useState(false);
const [editingHolding, setEditingHolding] =
  useState<StockHoldingWithAccount | null>(null);

// tRPC queries
const { data: calendarYears } = trpc.calendarYear.getCalendarYears.useQuery({
  type: 'FISCAL',
});
const { data: brokerageAccounts } = trpc.business.getBusinessesByType.useQuery({
  type: 'BROKERAGE',
});
const { data: snapshots, isLoading: isLoadingSnapshots } =
  trpc.stockAsset.getSnapshots.useQuery(
    { calendarYearId: selectedCalendarYearId ?? undefined },
    { enabled: !!selectedCalendarYearId },
  );
const { data: snapshotTotals } = trpc.stockAsset.getSnapshotTotals.useQuery(
  { snapshotId: selectedSnapshotId! },
  { enabled: !!selectedSnapshotId },
);
const { data: latestSnapshot } = trpc.stockAsset.getMostRecentSnapshot.useQuery(
  { calendarYearId: selectedCalendarYearId ?? undefined },
  { enabled: !!selectedCalendarYearId },
);

// Mutations
const createSnapshotMutation = trpc.stockAsset.createSnapshot.useMutation();
const deleteSnapshotMutation = trpc.stockAsset.deleteSnapshot.useMutation();
const updateHoldingMutation = trpc.stockAsset.updateHolding.useMutation();
const deleteHoldingMutation = trpc.stockAsset.deleteHolding.useMutation();
```

### 8.4 Accordion Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Stock Portfolio                                       [+ New Snapshot] │
├─────────────────────────────────────────────────────────────────────────┤
│  Fiscal Year: [2025-2026 ▼]        Snapshot: [01 Feb 2026 ▼]          │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────┐  ┌────────────────────────────┐        │
│  │ 🇦🇺 AUD Holdings           │  │ 🇺🇸 USD Holdings           │        │
│  │ Portfolio:  $47,500.00     │  │ Portfolio:  $12,300.00     │        │
│  │ Unrealized: +$3,200.00 ▲  │  │ Unrealized: -$450.00 ▼    │        │
│  │ Realized:   +$1,240.00 ▲  │  │ Realized:   $0.00         │        │
│  └────────────────────────────┘  └────────────────────────────┘        │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ ▶ Commsec                           AUD   $35,200   +$2,100    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ ▼ MooMoo                            USD   $12,300   -$450      │   │
│  │ ┌───────────────────────────────────────────────────────────┐   │   │
│  │ │ Stock     Qty  Buy$  BuyDate  Cur$   Value    P/L   ...  │   │   │
│  │ │ AAPL      25   $145  15/06   $142   $3,550  -$75   ...  │   │   │
│  │ │ MSFT      10   $380  20/08   $395   $3,950  +$150  ...  │   │   │
│  │ └───────────────────────────────────────────────────────────┘   │   │
│  │                                             [+ Add Holding]     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ ▶ Commbank Pocket                   AUD   $12,300   +$1,100    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.5 Holdings Table Columns

| Column    | Source                   | Width  | Notes                                        |
| --------- | ------------------------ | ------ | -------------------------------------------- |
| Stock     | `ticker` + `companyName` | wide   | Two-line: ticker bold, company name subtitle |
| Qty       | `remainingQuantity`      | narrow | Shows remaining (not original)               |
| Buy $     | `buyPrice`               | narrow | Currency formatted                           |
| Buy Date  | `buyDate`                | narrow | DD/MM/YY format                              |
| Curr $    | `currentPrice`           | narrow | Current market price (manual)                |
| Value     | `marketValue`            | narrow | Qty × Curr $ (calculated)                    |
| P/L       | `unrealizedPL`           | narrow | Color-coded green/red                        |
| P/L %     | `unrealizedPLPercent`    | narrow | Color-coded                                  |
| Plan      | `plannedTerm`            | narrow | Badge: SHORT/MID/LONG                        |
| Holding   | `holdingPeriodMonths`    | narrow | "X mo" or "X yr, Y mo"                       |
| Sale $    | `salePrice`              | narrow | "-" if unsold                                |
| Sale Date | `saleDate`               | narrow | "-" if unsold                                |
| Sold Qty  | `soldQuantity`           | narrow | "-" if unsold                                |
| CGT       | `isCGTEligible`          | narrow | ✓ or ✗ icon                                  |
| Actions   | -                        | narrow | FiEdit2, FiTrash2 icons                      |

**Mobile responsive**: Table wraps in `overflow-x-auto` container. Priority columns (Stock, Qty, Value, P/L) always visible.

### 8.6 NewSnapshotModal.tsx

**Responsibilities**:

- Date picker for snapshot date (defaults to today)
- "Copy from previous snapshot" checkbox (default: checked)
- Multi-holding form with add/remove rows
- Each row: account dropdown, ticker, company, qty, prices, dates, term
- Save creates snapshot via tRPC mutation

**Prefill Logic**:

```typescript
// When modal opens with prefill enabled:
const { data: latestSnapshot } = trpc.stockAsset.getMostRecentSnapshot.useQuery(
  {},
);

useEffect(() => {
  if (prefillEnabled && latestSnapshot) {
    const prefilled = latestSnapshot.holdings.map((h) => ({
      accountId: h.accountId,
      ticker: h.ticker,
      companyName: h.companyName,
      quantity: Number(h.quantity),
      buyPrice: Number(h.buyPrice),
      buyDate: h.buyDate,
      currentPrice: Number(h.currentPrice), // User should update this
      currency: h.currency,
      plannedTerm: h.plannedTerm,
      // Don't prefill sale info (it's snapshot-specific)
      salePrice: null,
      saleDate: null,
      soldQuantity: null,
    }));
    setHoldingRows(prefilled);
  }
}, [latestSnapshot, prefillEnabled]);
```

### 8.7 HoldingFormModal.tsx

**Responsibilities**:

- Add new holding to existing snapshot OR edit existing holding
- Fields: account, ticker, company, quantity, buy price, buy date, current price, currency, planned term
- Optional sale section (collapsible): sale price, sale date, sold quantity
- Validation feedback inline

**Mode detection**:

- If `editingHolding` prop is set → Edit mode (pre-fill all fields, call `updateHolding`)
- If `snapshotId` prop is set without holding → Add mode (empty form, call `createHolding`)

### 8.8 SummaryCards.tsx

Stateless component receiving `CurrencyTotal[]` as props.

```tsx
type SummaryCardsProps = {
  currencyTotals: CurrencyTotal[];
};

// Renders one card per currency with:
// - Colored background (teal for AUD, blue for USD)
// - Portfolio value
// - Unrealized P/L (green/red)
// - Realized P/L (green/red)
```

### 8.9 Sidebar Navigation Update

Add "Stocks" link under the existing "Asset(s)" Disclosure in `src/layouts/SideNav.tsx`:

```tsx
<Disclosure.Panel as='ul' className={navigationStyles.disclosure.panel}>
  <SideNavLink name='Bank(s)' href='/cashflow/bank' className='border-b-0'>
    <IconBank />
  </SideNavLink>
  {/* NEW */}
  <SideNavLink name='Stocks' href='/cashflow/stocks' className='border-b-0'>
    <IconStocks /> {/* New icon needed - FiTrendingUp from react-icons/fi */}
  </SideNavLink>
</Disclosure.Panel>
```

**Icon**: Use `FiTrendingUp` from `react-icons/fi` or create a custom `IconStocks` in `SideNavIcons.tsx`.

---

## 9. State Management & Data Flow

### 9.1 Query Invalidation Pattern

After mutations, invalidate relevant queries to trigger refetch:

```typescript
const utils = trpc.useUtils();

// After creating a snapshot:
await createSnapshotMutation.mutateAsync(data);
await utils.stockAsset.getSnapshots.invalidate();
await utils.stockAsset.getMostRecentSnapshot.invalidate();
setSelectedSnapshotId(null); // Auto-select newest

// After updating a holding:
await updateHoldingMutation.mutateAsync(data);
await utils.stockAsset.getSnapshotById.invalidate({ snapshotId });
await utils.stockAsset.getSnapshotTotals.invalidate({ snapshotId });

// After deleting a holding:
await deleteHoldingMutation.mutateAsync({ holdingId });
await utils.stockAsset.getSnapshotById.invalidate({ snapshotId });
await utils.stockAsset.getSnapshotTotals.invalidate({ snapshotId });

// After deleting a snapshot:
await deleteSnapshotMutation.mutateAsync({ snapshotId });
await utils.stockAsset.getSnapshots.invalidate();
setSelectedSnapshotId(null);
```

### 9.2 Data Flow: Page Load

```
1. Page loads → Server Component renders StockAssetsClient
2. StockAssetsClient renders → queries calendarYears (FISCAL type)
3. Auto-select current/latest fiscal year → sets selectedCalendarYearId
4. getSnapshots fires → returns all snapshots for fiscal year
5. Auto-select most recent snapshot → sets selectedSnapshotId
6. getSnapshotTotals fires → returns aggregated totals
7. Render: Summary cards + Account accordions + Holdings tables
```

### 9.3 Data Flow: Create Snapshot

```
1. User clicks "+ New Snapshot"
2. Modal opens → getMostRecentSnapshot fires for prefill
3. Form pre-fills with previous holdings (prices need updating)
4. User modifies prices, adds/removes holdings
5. User clicks Save → createSnapshot mutation fires
6. On success: close modal, invalidate queries, toast success
7. Page auto-refreshes with new snapshot data
```

### 9.4 Data Flow: Record Sale

```
1. User clicks Edit on a holding row
2. HoldingFormModal opens with holding data pre-filled
3. User expands "Sale Information" section
4. User enters: Sale Price, Sale Date, Sold Quantity
5. Validation: soldQuantity <= quantity, all three fields required
6. User clicks Save → updateHolding mutation fires
7. On success: close modal, invalidate snapshot queries, toast success
8. Holdings table updates: shows sale info, recalculates P/L
9. Summary cards update: shows realized P/L in totals
```

---

## 10. Calculation Logic

### 10.1 Core Calculations (Pure Functions)

File: Inline in `StockAssetsClient.tsx` or extracted to a utility.

```typescript
import { differenceInMonths } from 'date-fns';

export function calculateHoldingMetrics(
  holding: StockHoldingWithAccount,
  snapshotDate: Date,
): HoldingCalculations {
  const qty = Number(holding.quantity);
  const soldQty = holding.soldQuantity ? Number(holding.soldQuantity) : 0;
  const remainingQty = qty - soldQty;
  const buyPrice = Number(holding.buyPrice);
  const currentPrice = Number(holding.currentPrice);

  // Core calculations
  const costBasis = buyPrice * qty;
  const marketValue = remainingQty * currentPrice;
  const unrealizedPL =
    remainingQty > 0 ? (currentPrice - buyPrice) * remainingQty : 0;
  const unrealizedPLPercent =
    remainingQty > 0 && buyPrice > 0
      ? ((currentPrice - buyPrice) / buyPrice) * 100
      : 0;

  // Realized P/L
  const salePrice = holding.salePrice ? Number(holding.salePrice) : 0;
  const realizedPL = soldQty > 0 ? (salePrice - buyPrice) * soldQty : 0;

  // Holding period
  const endDate = holding.saleDate ?? snapshotDate;
  const holdingPeriodMonths = differenceInMonths(endDate, holding.buyDate);

  // CGT eligibility (only relevant for sold holdings)
  const isCGTEligible = soldQty > 0 && holdingPeriodMonths >= 12;

  // Sale status
  const isSold = soldQty > 0;
  const isFullySold = soldQty >= qty;

  // Term status comparison
  const termStatus = calculateTermStatus(
    holding.plannedTerm,
    holdingPeriodMonths,
    isSold,
  );

  return {
    remainingQuantity: remainingQty,
    costBasis,
    marketValue,
    unrealizedPL,
    unrealizedPLPercent,
    realizedPL,
    holdingPeriodMonths,
    isCGTEligible,
    isSold,
    isFullySold,
    termStatus,
  };
}
```

### 10.2 Term Status Logic

```typescript
function calculateTermStatus(
  plannedTerm: InvestmentTermEnumType,
  actualMonths: number,
  isSold: boolean,
): TermStatus {
  const termThresholds = {
    SHORT_TERM: { min: 0, max: 11 },
    MID_TERM: { min: 12, max: 36 },
    LONG_TERM: { min: 37, max: Infinity },
  };

  const planned = termThresholds[plannedTerm];

  if (isSold) {
    // For sold stocks: compare actual holding to planned range
    if (actualMonths >= planned.min && actualMonths <= planned.max)
      return 'ON_TRACK';
    if (actualMonths > planned.max) return 'AHEAD';
    return 'BEHIND'; // Sold earlier than planned
  }

  // For unsold stocks: are they on track to meet the planned term?
  if (actualMonths <= planned.max) return 'ON_TRACK';
  return 'AHEAD'; // Held longer than planned category
}
```

### 10.3 CGT Discount Projection (Unsold Holdings)

For unsold holdings, show projected CGT eligibility date:

```typescript
function getProjectedCGTDate(buyDate: Date): Date {
  return addMonths(buyDate, 12);
}

function getCGTProjectionText(buyDate: Date, snapshotDate: Date): string {
  const eligibleDate = getProjectedCGTDate(buyDate);
  if (snapshotDate >= eligibleDate) return 'Eligible now';
  const monthsRemaining = differenceInMonths(eligibleDate, snapshotDate);
  return `${monthsRemaining} months to CGT discount`;
}
```

### 10.4 Formatting Utilities

```typescript
export function formatCurrency(
  value: number,
  currency: CurrencyEnumType,
): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatPL(value: number, currency: CurrencyEnumType): string {
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${formatCurrency(value, currency)}`;
}

export function formatHoldingPeriod(months: number): string {
  if (months < 12) return `${months} mo`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (remainingMonths === 0) return `${years} yr`;
  return `${years} yr, ${remainingMonths} mo`;
}

export function formatQuantity(qty: number): string {
  // Show decimals only if fractional
  return qty % 1 === 0 ? qty.toString() : qty.toFixed(4);
}
```

---

## 11. Implementation Phases

### Phase 1: Database & API Foundation (3-4 days)

**Objective**: All backend infrastructure ready and testable.

**Files to Create**:

| File                                               | Description                       | Est. Lines |
| -------------------------------------------------- | --------------------------------- | ---------- |
| `src/server/schema/stock-asset.schema.ts`          | Zod validation schemas            | ~120       |
| `src/server/services/stock-asset.service.ts`       | Database operations (9 functions) | ~350       |
| `src/server/controllers/stock-asset.controller.ts` | Request handlers (9 handlers)     | ~180       |
| `src/server/trpc/router/stock-asset.ts`            | tRPC router (9 endpoints)         | ~80        |
| `src/types/stock-asset.types.ts`                   | TypeScript type definitions       | ~100       |

**Files to Modify**:

| File                             | Change                                  |
| -------------------------------- | --------------------------------------- |
| `prisma/schema.prisma`           | Add enums + 2 models + relation updates |
| `src/server/trpc/router/_app.ts` | Register `stockAssetRouter`             |

**Tasks**:

1. Add `BROKERAGE` to `BusinessEnumType` enum
2. Add `InvestmentTermEnumType` and `CurrencyEnumType` enums
3. Create `StockSnapshot` and `StockHolding` models
4. Add relations to `User` and `Business` models
5. Run `prisma migrate dev`
6. Run `prisma generate`
7. Create Zod schemas with cross-field validation
8. Create service layer (9 functions)
9. Create controller layer (9 handlers)
10. Create tRPC router and register in `_app.ts`
11. Create type definitions
12. Verify build passes: `pnpm run build`

**Deliverable**: All 9 tRPC endpoints operational, authentication enforced, user data isolation verified.

---

### Phase 2: Core UI - Display (3-4 days)

**Objective**: Page renders with selectors, summary cards, and accordion display.

**Files to Create**:

| File                                                         | Description                | Est. Lines |
| ------------------------------------------------------------ | -------------------------- | ---------- |
| `src/app/(authorized)/cashflow/stocks/page.tsx`              | Server component           | ~30        |
| `src/app/(authorized)/cashflow/stocks/StockAssetsClient.tsx` | Client component (main UI) | ~400       |
| `src/app/(authorized)/cashflow/stocks/SummaryCards.tsx`      | Currency total cards       | ~80        |
| `src/app/(authorized)/cashflow/stocks/_types.ts`             | Feature-local types        | ~20        |

**Files to Modify**:

| File                           | Change                           |
| ------------------------------ | -------------------------------- |
| `src/layouts/SideNav.tsx`      | Add "Stocks" link under Asset(s) |
| `src/layouts/SideNavIcons.tsx` | Add `IconStocks` component       |

**Tasks**:

1. Create page.tsx server component
2. Build StockAssetsClient with fiscal year selector
3. Add snapshot date dropdown
4. Create SummaryCards component (AUD/USD totals)
5. Build account accordion with Headless UI Disclosure
6. Build holdings table within accordion (read-only display)
7. Implement calculation logic for P/L, CGT, term status
8. Add empty state handling (no brokerage accounts, no snapshots)
9. Add loading states
10. Add sidebar navigation link
11. Verify build passes: `pnpm run build`

**Deliverable**: User can navigate to Stocks page, see fiscal year filter, summary cards, and accordion with holdings table.

---

### Phase 3: Snapshot Management (3-4 days)

**Objective**: User can create new snapshots with prefill and manage holdings.

**Files to Create**:

| File                                                        | Description             | Est. Lines |
| ----------------------------------------------------------- | ----------------------- | ---------- |
| `src/app/(authorized)/cashflow/stocks/NewSnapshotModal.tsx` | Snapshot creation modal | ~400       |
| `src/app/(authorized)/cashflow/stocks/HoldingFormModal.tsx` | Add/edit holding modal  | ~300       |

**Tasks**:

1. Build NewSnapshotModal with date picker
2. Implement prefill from most recent snapshot
3. Add multi-holding form with add/remove rows
4. Account dropdown (Business type=BROKERAGE)
5. Currency and planned term dropdowns
6. Implement save with createSnapshot mutation
7. Build HoldingFormModal for adding to existing snapshot
8. Implement edit holding functionality (pre-fill from existing)
9. Add sale recording section (sale price, date, sold qty)
10. Add delete holding with confirmation dialog
11. Add delete snapshot with confirmation dialog
12. Add toast notifications for all operations
13. Implement query invalidation after mutations
14. Verify build passes: `pnpm run build`

**Deliverable**: Full CRUD functionality for snapshots and holdings.

---

### Phase 4: Polish & Testing (2-3 days)

**Objective**: Production-quality UX, error handling, and responsive design.

**Tasks**:

1. Add P/L color coding (green positive, red negative)
2. Add CGT badge/indicator styling
3. Add term status badges with color coding
4. Style sold holdings (SOLD badge or strikethrough)
5. Responsive table design (horizontal scroll)
6. Mobile-friendly touch targets
7. Keyboard accessibility (tab, enter, escape)
8. Error handling for all edge cases
9. Loading state refinements
10. Toast message consistency
11. Write unit tests for calculation utilities
12. Integration tests for tRPC endpoints
13. Final build verification: `pnpm run build`
14. Restart dev server: `pnpm run dev`

**Deliverable**: Feature complete, tested, responsive, and production-ready.

---

## 12. Migration Strategy

### 12.1 Schema Migration

```bash
# 1. Stop dev server if running
# 2. Run migration
pnpm prisma migrate dev --name add_stock_asset_models
# 3. Regenerate Prisma client
pnpm prisma generate
# 4. Verify build
pnpm run build
# 5. Restart dev server
pnpm run dev
```

### 12.2 Migration SQL (Expected)

```sql
-- Add to BusinessEnumType
ALTER TYPE "BusinessEnumType" ADD VALUE 'BROKERAGE';

-- Create new enums
CREATE TYPE "InvestmentTermEnumType" AS ENUM ('SHORT_TERM', 'MID_TERM', 'LONG_TERM');
CREATE TYPE "CurrencyEnumType" AS ENUM ('AUD', 'USD');

-- Create StockSnapshot table
CREATE TABLE "StockSnapshot" (
    "id" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StockSnapshot_pkey" PRIMARY KEY ("id")
);

-- Create StockHolding table
CREATE TABLE "StockHolding" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "quantity" DECIMAL(12,6) NOT NULL,
    "buyPrice" MONEY NOT NULL,
    "buyDate" TIMESTAMP(3) NOT NULL,
    "currentPrice" MONEY NOT NULL,
    "currency" "CurrencyEnumType" NOT NULL,
    "plannedTerm" "InvestmentTermEnumType" NOT NULL,
    "salePrice" MONEY,
    "saleDate" TIMESTAMP(3),
    "soldQuantity" DECIMAL(12,6),
    "accountId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StockHolding_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "StockSnapshot_userId_snapshotDate_idx" ON "StockSnapshot"("userId", "snapshotDate");
CREATE INDEX "StockHolding_snapshotId_idx" ON "StockHolding"("snapshotId");
CREATE INDEX "StockHolding_accountId_idx" ON "StockHolding"("accountId");
CREATE INDEX "StockHolding_ticker_idx" ON "StockHolding"("ticker");

-- Foreign keys
ALTER TABLE "StockSnapshot" ADD CONSTRAINT "StockSnapshot_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "StockHolding" ADD CONSTRAINT "StockHolding_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Business"("id") ON DELETE RESTRICT;
ALTER TABLE "StockHolding" ADD CONSTRAINT "StockHolding_snapshotId_fkey"
    FOREIGN KEY ("snapshotId") REFERENCES "StockSnapshot"("id") ON DELETE CASCADE;
```

### 12.3 Safety Considerations

- **No destructive changes**: This migration only adds new tables and enums. No existing data is modified.
- **Adding enum value**: PostgreSQL supports `ALTER TYPE ... ADD VALUE` without affecting existing data.
- **Business FK**: `StockHolding.accountId` → `Business.id` uses `ON DELETE RESTRICT` to prevent accidental deletion of brokerage accounts with holdings.
- **User FK**: `StockSnapshot.userId` → `User.id` uses `ON DELETE CASCADE` to clean up when user is deleted.

---

## Appendix A: Comparison with Bank Assets Implementation

| Aspect           | Bank Assets                         | Stock Assets                           | Notes                              |
| ---------------- | ----------------------------------- | -------------------------------------- | ---------------------------------- |
| Route            | `/cashflow/bank`                    | `/cashflow/stocks`                     | Same parent group                  |
| Router Name      | `bankAsset`                         | `stockAsset`                           | Consistent naming                  |
| Snapshot Model   | `BankAssetSnapshot`                 | `StockSnapshot`                        | Simplified name                    |
| Entry Model      | `BankAssetEntry` (1 field: balance) | `StockHolding` (12+ fields)            | Much more complex                  |
| Account Model    | `BankAccount` (dedicated)           | `Business` (type=BROKERAGE)            | Stocks use Business directly       |
| Currency         | Single (AUD)                        | Multi (AUD/USD)                        | Summary cards per currency         |
| Calendar filter  | calendarType + calendarYearId       | calendarYearId only (FISCAL)           | Stocks: fiscal year only initially |
| Totals           | `grandTotal` (single number)        | `currencyTotals[]` (per currency)      | More complex aggregation           |
| Accordion header | Bank name + total                   | Account name + currency + total + P/L  | Richer summary                     |
| Entry display    | Simple table: name, balance         | Complex table: 14+ columns             | Horizontal scroll needed           |
| Pre-fill         | Copy all entries with balances      | Copy all holdings (prices need update) | Similar pattern                    |
| Account creation | CreatableSelect (inline)            | Business settings page                 | Different UX                       |
| Calculations     | None (raw balances)                 | P/L, CGT, term status                  | Significant frontend logic         |

---

## Appendix B: Dependencies

### NPM Packages (Already Installed)

- `@headlessui/react` - Disclosure/accordion component
- `react-select` - Account dropdown
- `react-number-format` - NumericFormat for currency input
- `react-icons` - FiEdit2, FiTrash2, FiChevronDown, FiPlus, FiTrendingUp
- `date-fns` - differenceInMonths, addMonths, format
- `react-toastify` - Toast notifications
- `zod` - Schema validation

### No New Dependencies Required

All required packages are already installed in the project.

---

**Document Version**: 1.0
**Last Updated**: 2026-02-28
**Author**: AI-assisted design based on PRD v1.1 and bank-assets reference implementation
