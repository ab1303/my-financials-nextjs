# Low Level Design: AI Usage Logging & Admin Spend Dashboard

> **Version**: 1.0  
> **Date**: 2026-03-31  
> **Status**: Draft  
> **Parent**: [AI Usage Logging HLD](./ai-usage-logging-hld.md)

---

## Table of Contents

1. [Database Schema Changes](#1-database-schema-changes)
2. [Pricing Constants Module](#2-pricing-constants-module)
3. [AI Vision Service Changes](#3-ai-vision-service-changes)
4. [Parse Route Changes](#4-parse-route-changes)
5. [Exchange Rate Service](#5-exchange-rate-service)
6. [Admin Procedure Middleware](#6-admin-procedure-middleware)
7. [tRPC Router: aiUsage](#7-trpc-router-aiusage)
8. [AIUsageCard Component](#8-aiusagecard-component)
9. [Page Integrations (User-Facing)](#9-page-integrations-user-facing)
10. [Dashboard Page](#10-dashboard-page)
11. [Admin: Overview Page](#11-admin-overview-page)
12. [Admin: User Drill-Down Page](#12-admin-user-drill-down-page)
13. [SideNav Update](#13-sidenav-update)
14. [ImportTypeEnum Extension](#14-importtypeenum-extension)
15. [Error Handling](#15-error-handling)
16. [Testing Strategy](#16-testing-strategy)

---

## 1. Database Schema Changes

### File: `prisma/schema.prisma`

#### 1.1 New Model: `AIUsageLog`

```prisma
model AIUsageLog {
  id               String           @id @default(cuid())
  session          AIImportSession  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  sessionId        String
  user             User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId           String
  importType       ImportTypeEnum   // Denormalized from session for efficient querying
  model            String           // e.g., "gpt-4o"
  promptTokens     Int
  completionTokens Int
  totalTokens      Int
  estimatedCostUSD Decimal          @db.Money
  imageId          String?          // Optional FK to ImportImage (nullable if log is session-level)
  createdAt        DateTime         @default(now())

  @@index([userId, createdAt])       // User-scoped time-range queries (user cards, dashboard)
  @@index([sessionId])               // Join back to session
  @@index([importType, createdAt])   // Admin category-filtered queries
  @@index([userId, importType, createdAt]) // Compound index for user+type+date (most common query)
}
```

**Index rationale**:

- `[userId, createdAt]` — Covers `getUsageSummary` and `getDashboardUsage` with date range.
- `[userId, importType, createdAt]` — Covers the most frequent read pattern: user + type + date range filter.
- `[importType, createdAt]` — Covers admin `getAllUsersUsage` with type filter.
- `[sessionId]` — Efficient join to `AIImportSession`.

#### 1.2 Updated Relations

Add reverse relation on `AIImportSession`:

```prisma
model AIImportSession {
  // ... existing fields ...
  usageLogs AIUsageLog[]  // ← ADD
}
```

Add reverse relation on `User`:

```prisma
model User {
  // ... existing fields ...
  AIUsageLog AIUsageLog[]  // ← ADD
}
```

#### 1.3 Migration

```bash
# Stop dev server first (Windows EPERM safety)
pnpm prisma migrate dev --name add_ai_usage_log
```

---

## 2. Pricing Constants Module

### New File: `src/constants/ai-pricing.ts`

```typescript
/**
 * AI model pricing constants.
 * Source: https://openai.com/api/pricing/ (as of March 2026)
 *
 * GPT-4o pricing:
 *   Input:  $2.50 per 1M tokens
 *   Output: $10.00 per 1M tokens
 */

export const AI_MODEL_NAME = 'gpt-4o' as const;

export const GPT4O_INPUT_COST_PER_TOKEN = 2.5 / 1_000_000; // $0.0000025
export const GPT4O_OUTPUT_COST_PER_TOKEN = 10.0 / 1_000_000; // $0.0000100

/**
 * Calculate estimated USD cost from token usage.
 */
export function calculateEstimatedCost(
  promptTokens: number,
  completionTokens: number,
): number {
  return (
    promptTokens * GPT4O_INPUT_COST_PER_TOKEN +
    completionTokens * GPT4O_OUTPUT_COST_PER_TOKEN
  );
}
```

This module is intentionally simple with no external dependencies. Token rates are constants, not environment variables, because:

1. They change infrequently (pricing page updates are major events).
2. Env vars would require a redeploy anyway.
3. A code change creates a git history of pricing changes.

---

## 3. AI Vision Service Changes

### File: `src/server/services/ai-import/_types.ts`

Add usage data to the extraction result interfaces:

```typescript
// ADD this interface
export interface AITokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// MODIFY existing interfaces — add `usage` field
export interface ExpenseExtractionResult {
  success: boolean;
  confidence: number;
  entries: { categoryName: string; amount: number }[];
  warnings: string[];
  raw: unknown;
  usage: AITokenUsage; // ← ADD
}

export interface BankAssetExtractionResult {
  success: boolean;
  confidence: number;
  entries: { accountName: string; balance: number; currency?: string }[];
  bankName?: string;
  warnings: string[];
  raw: unknown;
  usage: AITokenUsage; // ← ADD
}
```

### File: `src/server/services/ai-import/ai-vision.service.ts`

Change in `extractExpenseData()`:

```typescript
// BEFORE
const { text } = await generateText({ ... });

// AFTER
const { text, usage } = await generateText({ ... });
```

Update the return statement:

```typescript
// BEFORE
return {
  success: true,
  confidence: validated.confidence,
  entries: validated.entries,
  warnings: validated.warnings,
  raw: parsed,
};

// AFTER
return {
  success: true,
  confidence: validated.confidence,
  entries: validated.entries,
  warnings: validated.warnings,
  raw: parsed,
  usage: {
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
  },
};
```

Apply the identical change to `extractBankAssetData()`.

> **Reference**: The Vercel AI SDK `generateText()` returns a `usage` property containing `{ promptTokens, completionTokens, totalTokens }`. See [Vercel AI SDK — Usage Information](https://sdk.vercel.ai/docs/ai-sdk-core/generating-text#usage-information).

---

## 4. Parse Route Changes

### File: `src/app/api/ai-import/parse/route.ts`

Add import at the top:

```typescript
import { calculateEstimatedCost, AI_MODEL_NAME } from '@/constants/ai-pricing';
```

Inside the per-image processing loop, after `extractExpenseData()` succeeds and before (or after) `mapExpenseData()`, insert the usage log write:

```typescript
// After extraction succeeds and extractionResult is available:
const estimatedCostUSD = calculateEstimatedCost(
  extractionResult.usage.promptTokens,
  extractionResult.usage.completionTokens,
);

await prisma.aIUsageLog.create({
  data: {
    sessionId: importSession.id,
    userId,
    importType: importType as ImportTypeEnum,
    model: AI_MODEL_NAME,
    promptTokens: extractionResult.usage.promptTokens,
    completionTokens: extractionResult.usage.completionTokens,
    totalTokens: extractionResult.usage.totalTokens,
    estimatedCostUSD,
    imageId,
  },
});
```

**Placement**: This write must happen inside the `try` block for each image, after the AI call returns but before the SSE `saved` event is emitted. If the log write fails, it should **not** abort the import — wrap in a try/catch that logs to `console.error` but does not rethrow. Usage logging is non-critical.

```typescript
// Non-blocking usage logging
try {
  await prisma.aIUsageLog.create({ data: { ... } });
} catch (logError) {
  console.error('[ai-import/parse] Failed to log AI usage:', logError);
}
```

Apply the same pattern for the `BANK_ASSET` branch when Phase 5 is implemented.

---

## 5. Exchange Rate Service

### New File: `src/server/services/exchange-rate.service.ts`

```typescript
/**
 * Exchange Rate Service
 *
 * Fetches live USD→AUD exchange rate from open.er-api.com.
 * Caches in-memory with a 1-hour TTL.
 * Falls back to a hardcoded rate if the API is unreachable.
 *
 * API docs: https://open.er-api.com/
 * No API key required (free tier).
 */

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const FALLBACK_USD_TO_AUD = 1.55;
const API_URL = 'https://open.er-api.com/v6/latest/USD';

interface CachedRate {
  rate: number;
  fetchedAt: number;
}

let cachedRate: CachedRate | null = null;

export async function getUSDtoAUDRate(): Promise<number> {
  // Return cached value if fresh
  if (cachedRate && Date.now() - cachedRate.fetchedAt < CACHE_TTL_MS) {
    return cachedRate.rate;
  }

  try {
    const response = await fetch(API_URL, {
      signal: AbortSignal.timeout(5000), // 5s timeout
    });

    if (!response.ok) {
      throw new Error(`FX API returned ${response.status}`);
    }

    const data = (await response.json()) as {
      result: string;
      rates: Record<string, number>;
    };

    const audRate = data.rates?.AUD;
    if (typeof audRate !== 'number' || audRate <= 0) {
      throw new Error('Invalid AUD rate in response');
    }

    cachedRate = { rate: audRate, fetchedAt: Date.now() };
    return audRate;
  } catch (error) {
    console.error('[ExchangeRateService] Failed to fetch rate:', error);

    // Return stale cache if available, otherwise fallback
    if (cachedRate) {
      return cachedRate.rate;
    }
    return FALLBACK_USD_TO_AUD;
  }
}

/**
 * Convert USD amount to AUD.
 */
export async function convertUSDtoAUD(usdAmount: number): Promise<{
  audAmount: number;
  rate: number;
}> {
  const rate = await getUSDtoAUDRate();
  return {
    audAmount: usdAmount * rate,
    rate,
  };
}
```

**Design notes**:

- Module-level `cachedRate` works in both serverless (short-lived) and long-running (Node.js) contexts. In serverless, the cache resets per cold start which is acceptable since we're not rate-limited.
- `AbortSignal.timeout(5000)` prevents the FX call from blocking page renders. Available in Node.js 18+ which this project targets.
- Stale cache is preferred over fallback — if we had a good rate 2 hours ago, it's still better than the hardcoded constant.

---

## 6. Admin Procedure Middleware

### File: `src/server/trpc/trpc.ts`

Add after the existing `protectedProcedure`:

```typescript
/**
 * Middleware to ensure user has admin role
 */
const isAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  if (ctx.session.user.role !== 'admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin access required',
    });
  }
  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

/**
 * Admin-only procedure — requires authenticated user with role='admin'
 */
export const adminProcedure = t.procedure.use(isAdmin);
```

**Why a separate middleware rather than chaining**: The `isAdmin` middleware explicitly checks both auth and role in a single step rather than composing `isAuthed` + role check. This provides a clearer error: `UNAUTHORIZED` for no session vs `FORBIDDEN` for wrong role.

> **Alternative considered**: `protectedProcedure.use(isAdminMiddleware)` — this would work too and reuse `isAuthed`. However, the explicit version above is more readable for AI agents and avoids coupling to the internal implementation of `protectedProcedure`.

---

## 7. tRPC Router: aiUsage

### New File: `src/server/trpc/router/ai-usage.ts`

```typescript
import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from '@/server/trpc/trpc';
import { prisma } from '@/server/db/client';

const dateRangeSchema = z.object({
  dateFrom: z.date(),
  dateTo: z.date(),
});

export const aiUsageRouter = router({
  /**
   * Get usage summary for the authenticated user.
   * Scoped by importType and date range.
   * Used by: AIUsageCard on each feature page
   */
  getUsageSummary: protectedProcedure
    .input(
      z.object({
        importType: z.enum(['EXPENSE', 'BANK_ASSET', 'STOCK']),
        dateFrom: z.date(),
        dateTo: z.date(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const { importType, dateFrom, dateTo } = input;

      const result = await prisma.aIUsageLog.aggregate({
        where: {
          userId,
          importType,
          createdAt: { gte: dateFrom, lte: dateTo },
        },
        _sum: {
          estimatedCostUSD: true,
        },
        _count: {
          id: true, // total log entries (≈ images)
        },
      });

      // Count distinct sessions separately (aggregate can't do COUNT DISTINCT)
      const sessionCount = await prisma.aIUsageLog.groupBy({
        by: ['sessionId'],
        where: {
          userId,
          importType,
          createdAt: { gte: dateFrom, lte: dateTo },
        },
      });

      return {
        totalCostUSD: Number(result._sum.estimatedCostUSD ?? 0),
        totalImages: result._count.id,
        totalSessions: sessionCount.length,
      };
    }),

  /**
   * Get per-importType usage for the current calendar month.
   * Used by: Dashboard (/home) per-feature cards
   */
  getDashboardUsage: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const now = new Date();
    const dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const dateTo = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const grouped = await prisma.aIUsageLog.groupBy({
      by: ['importType'],
      where: {
        userId,
        createdAt: { gte: dateFrom, lte: dateTo },
      },
      _sum: {
        estimatedCostUSD: true,
      },
      _count: {
        id: true,
      },
    });

    // Get session counts per type
    const sessionCounts = await prisma.aIUsageLog.groupBy({
      by: ['importType', 'sessionId'],
      where: {
        userId,
        createdAt: { gte: dateFrom, lte: dateTo },
      },
    });

    // Aggregate session counts by importType
    const sessionsByType = sessionCounts.reduce(
      (acc, row) => {
        acc[row.importType] = (acc[row.importType] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return grouped.map((g) => ({
      importType: g.importType,
      totalCostUSD: Number(g._sum.estimatedCostUSD ?? 0),
      totalImages: g._count.id,
      totalSessions: sessionsByType[g.importType] ?? 0,
    }));
  }),

  // ─── Admin Procedures ──────────────────────────────────────────────

  /**
   * Get AI usage summary for ALL users.
   * Used by: Admin overview page (/settings/ai-usage)
   */
  getAllUsersUsage: adminProcedure
    .input(dateRangeSchema)
    .query(async ({ input }) => {
      const { dateFrom, dateTo } = input;

      const grouped = await prisma.aIUsageLog.groupBy({
        by: ['userId'],
        where: {
          createdAt: { gte: dateFrom, lte: dateTo },
        },
        _sum: {
          estimatedCostUSD: true,
          totalTokens: true,
        },
        _count: {
          id: true,
        },
        orderBy: {
          _sum: {
            estimatedCostUSD: 'desc',
          },
        },
      });

      // Fetch user details
      const userIds = grouped.map((g) => g.userId);
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u]));

      // Session counts per user
      const sessionCounts = await prisma.aIUsageLog.groupBy({
        by: ['userId', 'sessionId'],
        where: {
          createdAt: { gte: dateFrom, lte: dateTo },
        },
      });
      const sessionsByUser = sessionCounts.reduce(
        (acc, row) => {
          acc[row.userId] = (acc[row.userId] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      return grouped.map((g) => {
        const user = userMap.get(g.userId);
        return {
          userId: g.userId,
          userName: user?.name ?? 'Unknown',
          userEmail: user?.email ?? '',
          totalCostUSD: Number(g._sum.estimatedCostUSD ?? 0),
          totalTokens: g._sum.totalTokens ?? 0,
          totalImages: g._count.id,
          totalSessions: sessionsByUser[g.userId] ?? 0,
        };
      });
    }),

  /**
   * Get per-importType breakdown for a specific user.
   * Used by: Admin drill-down page (/settings/ai-usage/[userId])
   */
  getUserCategoryBreakdown: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        dateFrom: z.date(),
        dateTo: z.date(),
      }),
    )
    .query(async ({ input }) => {
      const { userId, dateFrom, dateTo } = input;

      // Verify user exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true },
      });
      if (!user) {
        throw new Error('User not found');
      }

      const grouped = await prisma.aIUsageLog.groupBy({
        by: ['importType'],
        where: {
          userId,
          createdAt: { gte: dateFrom, lte: dateTo },
        },
        _sum: {
          estimatedCostUSD: true,
          promptTokens: true,
          completionTokens: true,
          totalTokens: true,
        },
        _count: {
          id: true,
        },
      });

      // Session counts per type
      const sessionCounts = await prisma.aIUsageLog.groupBy({
        by: ['importType', 'sessionId'],
        where: {
          userId,
          createdAt: { gte: dateFrom, lte: dateTo },
        },
      });
      const sessionsByType = sessionCounts.reduce(
        (acc, row) => {
          acc[row.importType] = (acc[row.importType] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      return {
        user: { id: user.id, name: user.name, email: user.email },
        categories: grouped.map((g) => ({
          importType: g.importType,
          totalCostUSD: Number(g._sum.estimatedCostUSD ?? 0),
          promptTokens: g._sum.promptTokens ?? 0,
          completionTokens: g._sum.completionTokens ?? 0,
          totalTokens: g._sum.totalTokens ?? 0,
          totalImages: g._count.id,
          totalSessions: sessionsByType[g.importType] ?? 0,
        })),
      };
    }),
});
```

### File: `src/server/trpc/router/_app.ts`

```typescript
// ADD import
import { aiUsageRouter } from './ai-usage';

export const appRouter = router({
  // ... existing routers ...
  aiUsage: aiUsageRouter, // ← ADD
});
```

---

## 8. AIUsageCard Component

### New File: `src/components/AIUsageCard.tsx`

```typescript
'use client';

import { useMemo } from 'react';
import { NumericFormat } from 'react-number-format';
import { HiSparkles } from 'react-icons/hi2';
import { trpc } from '@/server/trpc/client';

type AIUsageCardProps = {
  importType: 'EXPENSE' | 'BANK_ASSET' | 'STOCK';
  dateFrom: Date;
  dateTo: Date;
  dateLabel: string; // e.g., "March 2026" or "FY 2025-2026"
};

export default function AIUsageCard({
  importType,
  dateFrom,
  dateTo,
  dateLabel,
}: AIUsageCardProps) {
  const { data, isLoading } = trpc.aiUsage.getUsageSummary.useQuery({
    importType,
    dateFrom,
    dateTo,
  });

  // Fetch AUD rate client-side (lightweight, cached by service)
  const { data: fxData } = trpc.aiUsage.getExchangeRate.useQuery(undefined, {
    staleTime: 60 * 60 * 1000, // Cache for 1h on client
  });

  const audAmount = useMemo(() => {
    if (!data || !fxData) return 0;
    return data.totalCostUSD * fxData.rate;
  }, [data, fxData]);

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="h-4 w-24 rounded bg-gray-200" />
        <div className="mt-2 h-6 w-32 rounded bg-gray-200" />
        <div className="mt-1 h-3 w-20 rounded bg-gray-200" />
      </div>
    );
  }

  const costUSD = data?.totalCostUSD ?? 0;
  const images = data?.totalImages ?? 0;
  const sessions = data?.totalSessions ?? 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
        <HiSparkles className="h-4 w-4 text-amber-500" />
        AI Usage
      </div>
      <div className="mt-1 text-lg font-semibold text-gray-900">
        <NumericFormat
          value={costUSD}
          displayType="text"
          prefix="$"
          decimalScale={4}
          fixedDecimalScale
          thousandSeparator
        />
        <span className="text-sm font-normal text-gray-500"> USD</span>
        {fxData && (
          <>
            <span className="mx-1 text-sm text-gray-400">/</span>
            <NumericFormat
              value={audAmount}
              displayType="text"
              prefix="$"
              decimalScale={4}
              fixedDecimalScale
              thousandSeparator
            />
            <span className="text-sm font-normal text-gray-500"> AUD</span>
          </>
        )}
      </div>
      <div className="mt-1 text-xs text-gray-400">
        {images} image{images !== 1 ? 's' : ''} · {sessions} session{sessions !== 1 ? 's' : ''} · {dateLabel}
      </div>
    </div>
  );
}
```

**Design notes**:

- Uses `react-number-format` (already in `package.json`) for consistent currency display.
- Uses `HiSparkles` from `react-icons/hi2` (Heroicons 2 — already a project dependency via `react-icons`).
- `decimalScale={4}` for micro-costs (AI calls can be $0.0012).
- Exchange rate fetched via a thin tRPC procedure that wraps the server-side FX service. This avoids CORS issues and keeps the FX API call server-side.
- The `staleTime: 60 * 60 * 1000` on the FX query matches the server-side cache TTL to avoid redundant fetches.

### Supporting tRPC Procedure for FX Rate

Add to `src/server/trpc/router/ai-usage.ts`:

```typescript
import { getUSDtoAUDRate } from '@/server/services/exchange-rate.service';

// Inside the router:
getExchangeRate: protectedProcedure.query(async () => {
  const rate = await getUSDtoAUDRate();
  return { rate, currency: 'AUD' as const };
}),
```

This exposes the cached server-side FX rate to the client without the client making direct calls to `open.er-api.com`.

---

## 9. Page Integrations (User-Facing)

### 9.1 Expense Page

### File: `src/app/(authorized)/cashflow/expense/ExpenseTableClient.tsx`

The component currently receives `calendarYearId` and `monthlySummaries` as props.

**Change**: Add `AIUsageCard` above or below the table. The date range needs to be derived from the calendar year. Two options:

**Option A** — Pass `dateFrom`/`dateTo` as additional props from the server component (recommended, avoids client-side refetch of calendar year data):

In `ExpenseTableServer.tsx` (or the parent `page.tsx`), compute and pass:

```typescript
<ExpenseTableClient
  calendarYearId={selectedCalendarYear.id}
  monthlySummaries={monthlySummaries}
  calendarDateFrom={new Date(selectedCalendarYear.fromYear, selectedCalendarYear.fromMonth - 1, 1)}
  calendarDateTo={new Date(selectedCalendarYear.toYear, selectedCalendarYear.toMonth - 1 + 1, 0)}
  calendarLabel={selectedCalendarYear.description}
/>
```

In `ExpenseTableClient.tsx`:

```tsx
// After existing imports:
import AIUsageCard from '@/components/AIUsageCard';

// Updated props type:
type ExpenseTableClientProps = {
  calendarYearId: string;
  monthlySummaries: MonthlyExpenseSummary[];
  calendarDateFrom: Date; // ← ADD
  calendarDateTo: Date; // ← ADD
  calendarLabel: string; // ← ADD
};

// In the JSX, above the table:
<AIUsageCard
  importType='EXPENSE'
  dateFrom={calendarDateFrom}
  dateTo={calendarDateTo}
  dateLabel={calendarLabel}
/>;
```

### 9.2 Bank Assets Page

### File: `src/app/(authorized)/cashflow/bank/BankAssetsClient.tsx`

Same pattern — pass `dateFrom`, `dateTo`, `dateLabel` from the server component based on the selected calendar year. The card uses `importType="BANK_ASSET"`.

### 9.3 Stocks Page

### File: `src/app/(authorized)/cashflow/stocks/StockAssetsClient.tsx`

Same pattern — pass date range from selected calendar year. The card uses `importType="STOCK"`.

> **Note**: For Stocks, the `STOCK` enum value must be added to `ImportTypeEnum` first (see [Section 14](#14-importtypeenum-extension)). If deferred, use a conditional render that only shows the card when the enum exists.

---

## 10. Dashboard Page

### File: `src/app/(authorized)/home/page.tsx`

Replace the placeholder content with a dashboard layout. The page remains a **Server Component** but renders a Client Component for the interactive AI usage section.

#### Server Component (page.tsx):

```tsx
import type { Metadata } from 'next';
import DashboardAIUsage from './_components/DashboardAIUsage';

export const metadata: Metadata = {
  title: 'Dashboard | My Financials',
  description: 'Your financial overview',
};

export default function HomePage() {
  return (
    <main className='bg-gray-50 p-6'>
      <h1 className='text-2xl font-bold text-gray-800'>Dashboard</h1>

      {/* AI Usage Section */}
      <section className='mt-6'>
        <h2 className='text-lg font-semibold text-gray-700'>
          AI Usage This Month
        </h2>
        <DashboardAIUsage />
      </section>

      {/* Future: Financial overview cards, charts, etc. */}
    </main>
  );
}
```

#### New Client Component: `src/app/(authorized)/home/_components/DashboardAIUsage.tsx`

```tsx
'use client';

import AIUsageCard from '@/components/AIUsageCard';

const IMPORT_TYPES = [
  { type: 'EXPENSE' as const, label: 'Expenses AI' },
  { type: 'BANK_ASSET' as const, label: 'Bank Assets AI' },
  { type: 'STOCK' as const, label: 'Stocks AI' },
];

export default function DashboardAIUsage() {
  const now = new Date();
  const dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const dateTo = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
  const monthLabel = now.toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className='mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
      {IMPORT_TYPES.map(({ type, label }) => (
        <div key={type}>
          <p className='mb-1 text-sm font-medium text-gray-600'>{label}</p>
          <AIUsageCard
            importType={type}
            dateFrom={dateFrom}
            dateTo={dateTo}
            dateLabel={monthLabel}
          />
        </div>
      ))}
    </div>
  );
}
```

---

## 11. Admin: Overview Page

### New File: `src/app/(authorized)/settings/ai-usage/page.tsx`

This is a **Server Component** shell that renders an interactive Client wrapper.

```tsx
import type { Metadata } from 'next';
import AIUsageAdminOverview from './_components/AIUsageAdminOverview';

export const metadata: Metadata = {
  title: 'AI Spend Overview | Settings',
};

export default function AIUsageAdminPage() {
  return (
    <main className='bg-gray-50 p-6'>
      <h1 className='text-2xl font-bold text-gray-800'>AI Spend Overview</h1>
      <AIUsageAdminOverview />
    </main>
  );
}
```

### New Client Component: `src/app/(authorized)/settings/ai-usage/_components/AIUsageAdminOverview.tsx`

Features:

- **Date range picker** — defaults to current calendar month `[1st of month, last of month]`.
- **Table** — uses TanStack Table (already a project dependency) with columns: User Name, Email, Total Cost (USD), Total Cost (AUD), Total Tokens, Images, Sessions.
- **Row click** — navigates to `/settings/ai-usage/{userId}`.
- **FX conversion** — fetches rate via `aiUsage.getExchangeRate` and computes AUD client-side.
- **Empty state** — "No AI usage recorded for this period."

```tsx
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  useReactTable,
  createColumnHelper,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';
import { NumericFormat } from 'react-number-format';
import { trpc } from '@/server/trpc/client';
import Table from '@/components/table';

// Type derived from tRPC output
type UserUsageRow = {
  userId: string;
  userName: string;
  userEmail: string;
  totalCostUSD: number;
  totalCostAUD: number;
  totalTokens: number;
  totalImages: number;
  totalSessions: number;
};

const columnHelper = createColumnHelper<UserUsageRow>();

export default function AIUsageAdminOverview() {
  const router = useRouter();
  const now = new Date();
  const [dateFrom, setDateFrom] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1),
  );
  const [dateTo, setDateTo] = useState(
    new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  );

  const { data: usageData, isLoading } = trpc.aiUsage.getAllUsersUsage.useQuery(
    {
      dateFrom,
      dateTo,
    },
  );

  const { data: fxData } = trpc.aiUsage.getExchangeRate.useQuery(undefined, {
    staleTime: 60 * 60 * 1000,
  });

  const rows: UserUsageRow[] = useMemo(() => {
    if (!usageData) return [];
    const rate = fxData?.rate ?? 0;
    return usageData.map((u) => ({
      ...u,
      totalCostAUD: u.totalCostUSD * rate,
    }));
  }, [usageData, fxData]);

  const columns = [
    columnHelper.accessor('userName', { header: 'Name' }),
    columnHelper.accessor('userEmail', { header: 'Email' }),
    columnHelper.accessor('totalCostUSD', {
      header: 'Cost (USD)',
      /* NumericFormat render with $ prefix, 4 decimal places */
    }),
    columnHelper.accessor('totalCostAUD', {
      header: 'Cost (AUD)',
      /* NumericFormat render with $ prefix, 4 decimal places */
    }),
    columnHelper.accessor('totalTokens', {
      header: 'Tokens',
      /* Thousands separator */
    }),
    columnHelper.accessor('totalImages', { header: 'Images' }),
    columnHelper.accessor('totalSessions', { header: 'Sessions' }),
  ];

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // Row click → drill-down
  function handleRowClick(userId: string) {
    const params = new URLSearchParams({
      dateFrom: dateFrom.toISOString(),
      dateTo: dateTo.toISOString(),
    });
    router.push(`/settings/ai-usage/${userId}?${params.toString()}`);
  }

  // ... render with date pickers, table, click handlers
}
```

**Date filter UI**: Use existing `DatePickerDialog` component (at `src/components/DatePickerDialog.tsx`) for the from/to date pickers to maintain visual consistency.

---

## 12. Admin: User Drill-Down Page

### New File: `src/app/(authorized)/settings/ai-usage/[userId]/page.tsx`

Server Component shell:

```tsx
import type { Metadata } from 'next';
import AIUsageUserDrillDown from './_components/AIUsageUserDrillDown';

export const metadata: Metadata = {
  title: 'User AI Spend | Settings',
};

type PageProps = {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>;
};

export default async function AIUsageUserPage({
  params,
  searchParams,
}: PageProps) {
  const { userId } = await params;
  const search = await searchParams;

  return (
    <main className='bg-gray-50 p-6'>
      <AIUsageUserDrillDown
        userId={userId}
        initialDateFrom={search.dateFrom}
        initialDateTo={search.dateTo}
      />
    </main>
  );
}
```

### New Client Component: `src/app/(authorized)/settings/ai-usage/[userId]/_components/AIUsageUserDrillDown.tsx`

Features:

- **Breadcrumb**: `AI Spend > {User Name}` — link back to `/settings/ai-usage`.
- **Date range filter** — initialized from URL searchParams, synced back.
- **Table** using TanStack Table with columns:

| Column            | Source Field                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Category          | `importType` → human label map: `EXPENSE` → "Monthly Expenses", `BANK_ASSET` → "Bank Assets", `STOCK` → "Stocks / Shares" |
| Cost (USD)        | `totalCostUSD`                                                                                                            |
| Cost (AUD)        | Computed from FX rate                                                                                                     |
| Prompt Tokens     | `promptTokens`                                                                                                            |
| Completion Tokens | `completionTokens`                                                                                                        |
| Total Tokens      | `totalTokens`                                                                                                             |
| Images            | `totalImages`                                                                                                             |
| Sessions          | `totalSessions`                                                                                                           |

**Import type label map** (create as a utility constant):

```typescript
// src/constants/import-type-labels.ts
export const IMPORT_TYPE_LABELS: Record<string, string> = {
  EXPENSE: 'Monthly Expenses',
  BANK_ASSET: 'Bank Assets',
  STOCK: 'Stocks / Shares',
};
```

---

## 13. SideNav Update

### File: `src/layouts/SideNav.tsx`

Add a new `SideNavLink` inside the admin-only `Disclosure.Panel`, after the "Calendar Year(s)" link:

```tsx
<SideNavLink name='AI Spend' href='/settings/ai-usage' className='border-b-0'>
  <IconAISpend /> {/* New icon component or inline SVG */}
</SideNavLink>
```

**Icon**: Use `HiSparkles` from `react-icons/hi2` wrapped in the project's icon sizing pattern (`className='mx-5 h-5 w-5'`). Create a new icon component at `src/layouts/SideNavIcons/IconAISpend.tsx` following the existing icon pattern:

```tsx
import { HiSparkles } from 'react-icons/hi2';

export default function IconAISpend() {
  return <HiSparkles className='mx-5 h-5 w-5' />;
}
```

Then add to the icon barrel export in `src/layouts/SideNavIcons/index.ts`.

---

## 14. ImportTypeEnum Extension

### Decision: Add `STOCK` to `ImportTypeEnum`

To support per-feature dashboard cards and future stock AI import without a separate migration:

```prisma
enum ImportTypeEnum {
  EXPENSE
  BANK_ASSET
  STOCK       // ← ADD
}
```

This is a safe, additive enum change — no existing data is altered. Include in the same migration as the `AIUsageLog` table creation.

> **Reference**: [Prisma — Enum changes](https://www.prisma.io/docs/orm/prisma-migrate/workflows/patching-and-hotfixing#enum-changes)

---

## 15. Error Handling

| Scenario                                    | Handling                                                                                                   |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --- | ---------------------------------------------- |
| `generateText()` fails                      | Existing error handling in parse route catches this. `AIUsageLog` is **not** written (no tokens consumed). |
| `AIUsageLog` write fails                    | Wrapped in try/catch; logged to `console.error`, does not abort the import. Usage logging is non-critical. |
| FX API unreachable                          | Returns stale cache or hardcoded fallback `1.55`. UI still renders with available rate.                    |
| FX rate returns invalid data                | Validation check (`typeof audRate !== 'number'                                                             |     | audRate <= 0`) → falls back to cache/constant. |
| Non-admin calls admin procedure             | `TRPCError({ code: 'FORBIDDEN' })` — client receives 403.                                                  |
| `AIUsageLog` table empty (new user)         | Card shows `$0.0000 USD / $0.0000 AUD`, `0 images · 0 sessions`. No error state needed.                    |
| `getUsageSummary` with invalid date range   | Zod validation rejects if `dateFrom`/`dateTo` are not valid `Date` objects. Returns 400.                   |
| Admin drill-down with non-existent `userId` | Procedure throws `Error('User not found')` → client shows error message.                                   |

---

## 16. Testing Strategy

### 16.1 Unit Tests

| Test             | File                                                          | What to Test                                                                                             |
| ---------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Cost calculation | `src/constants/__tests__/ai-pricing.test.ts`                  | `calculateEstimatedCost(1000, 500)` → expected USD value. Edge cases: 0 tokens, very large token counts. |
| FX service       | `src/server/services/__tests__/exchange-rate.service.test.ts` | Cache hit, cache miss, API failure fallback, stale cache preference. Mock `fetch`.                       |

### 16.2 Integration Tests

| Test                        | What to Test                                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Parse route logging         | Trigger a mock AI import → verify `AIUsageLog` record created with correct `promptTokens`, `completionTokens`, `estimatedCostUSD`. |
| tRPC `getUsageSummary`      | Seed `AIUsageLog` rows → call procedure → verify aggregated output matches.                                                        |
| tRPC `adminProcedure` guard | Call `getAllUsersUsage` with non-admin session → expect `FORBIDDEN`.                                                               |

### 16.3 E2E Tests (Playwright)

| Scenario                | Steps                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| User sees AI usage card | Login → navigate to `/cashflow/expense` → assert `AIUsageCard` renders with `$0.0000` for new user. |
| Admin overview page     | Login as admin → navigate to `/settings/ai-usage` → assert table renders.                           |
| Non-admin access denied | Login as regular user → navigate to `/settings/ai-usage` → assert redirect or error.                |

### 16.4 Build Verification

```bash
pnpm prisma generate   # Schema valid
pnpm run build          # Zero TypeScript / ESLint errors
```

---

## Appendix A: File Inventory

### New Files

| Path                                                                                   | Type             |
| -------------------------------------------------------------------------------------- | ---------------- |
| `src/constants/ai-pricing.ts`                                                          | Module           |
| `src/constants/import-type-labels.ts`                                                  | Module           |
| `src/server/services/exchange-rate.service.ts`                                         | Server Service   |
| `src/server/trpc/router/ai-usage.ts`                                                   | tRPC Router      |
| `src/components/AIUsageCard.tsx`                                                       | Client Component |
| `src/app/(authorized)/home/_components/DashboardAIUsage.tsx`                           | Client Component |
| `src/app/(authorized)/settings/ai-usage/page.tsx`                                      | Server Page      |
| `src/app/(authorized)/settings/ai-usage/_components/AIUsageAdminOverview.tsx`          | Client Component |
| `src/app/(authorized)/settings/ai-usage/[userId]/page.tsx`                             | Server Page      |
| `src/app/(authorized)/settings/ai-usage/[userId]/_components/AIUsageUserDrillDown.tsx` | Client Component |
| `src/layouts/SideNavIcons/IconAISpend.tsx`                                             | Component        |
| `prisma/migrations/{timestamp}_add_ai_usage_log/migration.sql`                         | Migration        |

### Modified Files

| Path                                                           | Change Summary                                                                              |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`                                         | Add `AIUsageLog` model, `STOCK` enum value, reverse relations on `User` + `AIImportSession` |
| `src/server/trpc/trpc.ts`                                      | Add `isAdmin` middleware + `adminProcedure`                                                 |
| `src/server/trpc/router/_app.ts`                               | Register `aiUsageRouter`                                                                    |
| `src/server/services/ai-import/_types.ts`                      | Add `AITokenUsage` interface, `usage` field to extraction results                           |
| `src/server/services/ai-import/ai-vision.service.ts`           | Destructure `usage` from `generateText()`, include in return                                |
| `src/app/api/ai-import/parse/route.ts`                         | Import pricing utils, write `AIUsageLog` per image                                          |
| `src/app/(authorized)/cashflow/expense/ExpenseTableClient.tsx` | Add `AIUsageCard` + date props                                                              |
| `src/app/(authorized)/cashflow/bank/BankAssetsClient.tsx`      | Add `AIUsageCard` + date props                                                              |
| `src/app/(authorized)/cashflow/stocks/StockAssetsClient.tsx`   | Add `AIUsageCard` + date props                                                              |
| `src/app/(authorized)/home/page.tsx`                           | Replace placeholder with dashboard layout                                                   |
| `src/layouts/SideNav.tsx`                                      | Add "AI Spend" link under admin Settings                                                    |
| `src/layouts/SideNavIcons/index.ts`                            | Export `IconAISpend`                                                                        |

### Dependency Changes

None — all dependencies (`react-icons`, `react-number-format`, `@tanstack/react-table`, `zod`) are already in `package.json`.

---

## Appendix B: External API Reference

### open.er-api.com

- **Endpoint**: `GET https://open.er-api.com/v6/latest/USD`
- **Auth**: None required
- **Rate limit**: ~1,500 requests/day (free tier)
- **Response shape**:
  ```json
  {
    "result": "success",
    "base_code": "USD",
    "rates": {
      "AUD": 1.5523,
      "EUR": 0.9245,
      ...
    }
  }
  ```
- **Docs**: [https://open.er-api.com/](https://open.er-api.com/)

### Vercel AI SDK — `generateText()` Usage

- **Return shape**: `{ text, usage: { promptTokens, completionTokens, totalTokens } }`
- **Docs**: [https://sdk.vercel.ai/docs/ai-sdk-core/generating-text](https://sdk.vercel.ai/docs/ai-sdk-core/generating-text)

### OpenAI GPT-4o Pricing (as of March 2026)

- **Input**: $2.50 per 1M tokens
- **Output**: $10.00 per 1M tokens
- **Pricing page**: [https://openai.com/api/pricing/](https://openai.com/api/pricing/)
