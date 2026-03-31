# High Level Design: AI Usage Logging & Admin Spend Dashboard

> **Version**: 1.0  
> **Date**: 2026-03-31  
> **Status**: Draft  
> **Depends on**: [AI Image Import PRD](../ai-image-import/ai-image-import-prd.md), [AI Image Import Unified Plan](../ai-image-import/ai-image-import-unified-plan.md)

---

## 1. Problem Statement

The application uses OpenAI GPT-4o vision API calls to extract financial data from uploaded screenshots. These API calls incur real costs billed per token. Currently:

- **Zero visibility** into how much each AI import session costs.
- **No token tracking** — the `usage` object returned by the Vercel AI SDK's `generateText()` is discarded.
- **No admin oversight** — there is no mechanism for the application owner (admin role) to monitor aggregate AI spend across all users.
- **No per-page context** — users have no awareness of AI costs relative to the time period they are viewing.

## 2. Goals

| #   | Goal                                                                                             | Audience |
| --- | ------------------------------------------------------------------------------------------------ | -------- |
| G1  | Track every AI API call with token counts and estimated cost                                     | System   |
| G2  | Show users a lightweight cost summary on each AI-enabled page, scoped to the page's date filter  | User     |
| G3  | Show per-feature AI usage cards on the user dashboard (current calendar month)                   | User     |
| G4  | Provide admin with a consolidated view of AI spend across all users                              | Admin    |
| G5  | Allow admin to drill into a single user's spend by AI feature category                           | Admin    |
| G6  | Display all costs in both USD (billing currency) and AUD (local currency) via live exchange rate | All      |

## 3. Non-Goals (Out of Scope)

- **Usage caps / rate limiting** — this plan covers logging and display only. Enforcement of spend limits is a separate future feature built on top of this data.
- **Real-time cost alerts / notifications** — not in scope.
- **Historical exchange rate storage at write time** — captured as a future consideration, not in v1.
- **Per-model pricing configurability** — v1 hardcodes GPT-4o rates. Multi-model support added when a second model is used.
- **Billing / invoicing** — this is cost visibility, not a billing system.

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                            │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Expense  │  │  Bank    │  │  Stocks  │  │    Dashboard      │  │
│  │  Page    │  │ Assets   │  │  Page    │  │    /home          │  │
│  │          │  │  Page    │  │          │  │                   │  │
│  │ ┌──────┐ │  │ ┌──────┐ │  │ ┌──────┐ │  │ ┌─────┐ ┌─────┐ │  │
│  │ │Usage │ │  │ │Usage │ │  │ │Usage │ │  │ │Exp. │ │Bank │ │  │
│  │ │Card  │ │  │ │Card  │ │  │ │Card  │ │  │ │Card │ │Card │ │  │
│  │ └──┬───┘ │  │ └──┬───┘ │  │ └──┬───┘ │  │ └──┬──┘ └──┬──┘ │  │
│  └────┼─────┘  └────┼─────┘  └────┼─────┘  └────┼───────┼────┘  │
│       │             │             │              │       │        │
│       └─────────────┴──────┬──────┴──────────────┴───────┘        │
│                            │ tRPC queries                         │
│  ┌─────────────────────────┼──────────────────────────────────┐   │
│  │       Admin: /settings/ai-usage                            │   │
│  │  ┌──────────────┐  ┌──────────────────┐                    │   │
│  │  │ All Users    │  │ User Drill-Down  │                    │   │
│  │  │ Overview     │──│ by Category      │                    │   │
│  │  └──────┬───────┘  └────────┬─────────┘                    │   │
│  └─────────┼───────────────────┼──────────────────────────────┘   │
│            │ tRPC admin queries │                                  │
└────────────┼───────────────────┼──────────────────────────────────┘
             │                   │
┌────────────┼───────────────────┼──────────────────────────────────┐
│            ▼ SERVER            ▼                                  │
│                                                                   │
│  ┌─────────────────────────────────────────────┐                  │
│  │           tRPC Router: aiUsage              │                  │
│  │                                             │                  │
│  │  protectedProcedure:                        │                  │
│  │    • getUsageSummary(type, dateFrom, dateTo) │                  │
│  │    • getDashboardUsage()                    │                  │
│  │                                             │                  │
│  │  adminProcedure:                            │                  │
│  │    • getAllUsersUsage(dateFrom, dateTo)      │                  │
│  │    • getUserCategoryBreakdown(userId, dates) │                  │
│  └──────────────────┬──────────────────────────┘                  │
│                     │ reads                                       │
│  ┌──────────────────▼──────────────────────────┐                  │
│  │               AIUsageLog (DB)               │                  │
│  └──────────────────▲──────────────────────────┘                  │
│                     │ writes                                      │
│  ┌──────────────────┴──────────────────────────┐                  │
│  │         POST /api/ai-import/parse           │                  │
│  │         (SSE streaming route)               │                  │
│  │                                             │                  │
│  │  Per-image loop:                            │                  │
│  │    1. extractExpenseData() / extractBank…() │                  │
│  │    2. { text, usage } ← generateText()     │  ◄── Vercel AI   │
│  │    3. calculateEstimatedCost(usage)         │      SDK         │
│  │    4. INSERT AIUsageLog row                 │                  │
│  └─────────────────────────────────────────────┘                  │
│                                                                   │
│  ┌─────────────────────────────────────────────┐                  │
│  │      Exchange Rate Service (cached 1h)      │                  │
│  │      open.er-api.com → USD/AUD rate         │                  │
│  └─────────────────────────────────────────────┘                  │
└───────────────────────────────────────────────────────────────────┘
```

## 5. Component Inventory

### 5.1 New Database Model

| Model        | Purpose                                                 | Key Fields                                                                                                                     |
| ------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `AIUsageLog` | Records per-image AI API token usage and estimated cost | `sessionId`, `userId`, `importType`, `model`, `promptTokens`, `completionTokens`, `totalTokens`, `estimatedCostUSD`, `imageId` |

### 5.2 New Server-Side Services

| Service                                        | Purpose                                              |
| ---------------------------------------------- | ---------------------------------------------------- |
| `src/constants/ai-pricing.ts`                  | GPT-4o token pricing constants + cost calculator     |
| `src/server/services/exchange-rate.service.ts` | Live USD→AUD rate with 1h cache + hardcoded fallback |

### 5.3 New tRPC Router

| Router    | Procedures                                     | Auth Level             |
| --------- | ---------------------------------------------- | ---------------------- |
| `aiUsage` | `getUsageSummary`, `getDashboardUsage`         | `protectedProcedure`   |
| `aiUsage` | `getAllUsersUsage`, `getUserCategoryBreakdown` | `adminProcedure` (new) |

### 5.4 New UI Components

| Component             | Type             | Location                                                   |
| --------------------- | ---------------- | ---------------------------------------------------------- |
| `AIUsageCard`         | Client Component | `src/components/AIUsageCard.tsx`                           |
| Admin Overview Page   | Server + Client  | `src/app/(authorized)/settings/ai-usage/page.tsx`          |
| Admin Drill-Down Page | Server + Client  | `src/app/(authorized)/settings/ai-usage/[userId]/page.tsx` |

### 5.5 Modified Files

| File                                                           | Change                                                              |
| -------------------------------------------------------------- | ------------------------------------------------------------------- |
| `prisma/schema.prisma`                                         | Add `AIUsageLog` model, update `User` + `AIImportSession` relations |
| `src/server/trpc/trpc.ts`                                      | Add `adminProcedure` middleware                                     |
| `src/server/trpc/router/_app.ts`                               | Register `aiUsage` router                                           |
| `src/server/services/ai-import/ai-vision.service.ts`           | Capture `usage` from `generateText()`                               |
| `src/server/services/ai-import/_types.ts`                      | Add usage fields to extraction result types                         |
| `src/app/api/ai-import/parse/route.ts`                         | Write `AIUsageLog` after each image parse                           |
| `src/app/(authorized)/cashflow/expense/ExpenseTableClient.tsx` | Add `AIUsageCard`                                                   |
| `src/app/(authorized)/cashflow/bank/BankAssetsClient.tsx`      | Add `AIUsageCard`                                                   |
| `src/app/(authorized)/cashflow/stocks/StockAssetsClient.tsx`   | Add `AIUsageCard`                                                   |
| `src/app/(authorized)/home/page.tsx`                           | Dashboard layout with per-feature usage cards                       |
| `src/layouts/SideNav.tsx`                                      | Add "AI Spend" link under Settings (admin-only)                     |

## 6. Data Flow

### 6.1 Write Path (Logging)

```
User triggers AI Import → POST /api/ai-import/parse
  → For each image:
      → generateText({ model: openai('gpt-4o'), ... })
      → Vercel AI SDK returns { text, usage: { promptTokens, completionTokens, totalTokens } }
      → calculateEstimatedCost(promptTokens, completionTokens) → costUSD
      → INSERT INTO AIUsageLog (sessionId, userId, importType, model, promptTokens, completionTokens, totalTokens, estimatedCostUSD, imageId)
      → Continue with existing extraction + mapping logic (unchanged)
```

### 6.2 Read Path (User Cards)

```
User visits Expense page (FY 2025-2026)
  → AIUsageCard mounts with importType=EXPENSE, dateFrom=2025-07-01, dateTo=2026-06-30
  → tRPC: aiUsage.getUsageSummary({ importType, dateFrom, dateTo })
  → Server: SELECT SUM(estimatedCostUSD), COUNT(DISTINCT imageId), COUNT(DISTINCT sessionId)
             FROM AIUsageLog
             WHERE userId = :currentUser AND importType = 'EXPENSE'
               AND createdAt BETWEEN :dateFrom AND :dateTo
  → Returns { totalCostUSD, totalImages, totalSessions }
  → Client: fetch AUD rate → display both currencies
```

### 6.3 Read Path (Admin)

```
Admin visits /settings/ai-usage
  → tRPC: aiUsage.getAllUsersUsage({ dateFrom, dateTo })
  → Server: SELECT userId, SUM(estimatedCostUSD), SUM(totalTokens), COUNT(DISTINCT imageId), COUNT(DISTINCT sessionId)
             FROM AIUsageLog
             WHERE createdAt BETWEEN :dateFrom AND :dateTo
             GROUP BY userId
             JOIN User ON ...
  → Returns per-user rows

Admin clicks user row → /settings/ai-usage/[userId]
  → tRPC: aiUsage.getUserCategoryBreakdown({ userId, dateFrom, dateTo })
  → Server: SELECT importType, SUM(estimatedCostUSD), SUM(promptTokens), SUM(completionTokens), SUM(totalTokens), COUNT(DISTINCT imageId), COUNT(DISTINCT sessionId)
             FROM AIUsageLog
             WHERE userId = :targetUser AND createdAt BETWEEN :dateFrom AND :dateTo
             GROUP BY importType
  → Returns per-category rows with full token detail
```

## 7. Exchange Rate Strategy

| Aspect       | Decision                                                                |
| ------------ | ----------------------------------------------------------------------- |
| API Provider | [open.er-api.com](https://open.er-api.com/) — free, no API key required |
| Endpoint     | `GET https://open.er-api.com/v6/latest/USD`                             |
| Caching      | Module-level in-memory cache, 1-hour TTL                                |
| Fallback     | Hardcoded rate (e.g., `1.55` AUD per USD) if API is unreachable         |
| When fetched | On-demand by UI components at display time (not stored in DB)           |

> **Future consideration**: Store `estimatedCostAUD` in `AIUsageLog` at write time for historical accuracy. Deferred to keep v1 schema simple.

## 8. Authorization Model

| Layer                          | Mechanism                                                                 | Notes                                                        |
| ------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Existing: `protectedProcedure` | Checks `ctx.session.user` exists                                          | Used for user-facing queries                                 |
| New: `adminProcedure`          | Extends `protectedProcedure` + checks `ctx.session.user.role === 'admin'` | Used for admin queries                                       |
| SideNav visibility             | `userRole === 'admin'` check (client-side)                                | Already exists; add "AI Spend" link                          |
| Admin page access              | `adminProcedure` on tRPC = server-side enforcement                        | Non-admin users get FORBIDDEN even if they navigate directly |

> **Reference**: tRPC middleware pattern — [tRPC Middleware Docs](https://trpc.io/docs/server/middlewares)

## 9. AI Feature Categories

The system tracks usage by `ImportTypeEnum`. Current and planned values:

| Enum Value         | Feature Page             | Status                      |
| ------------------ | ------------------------ | --------------------------- |
| `EXPENSE`          | Monthly Expense Tracking | ✅ Active (AI Import wired) |
| `BANK_ASSET`       | Bank Account Balances    | ⏳ Planned (Phase 5)        |
| `STOCK` (proposed) | Stock/Shares Portfolio   | ⏳ Future                   |

> **Decision needed**: Add `STOCK` to `ImportTypeEnum` now (single migration) or defer until stock AI import is built. **Recommendation**: Add now to avoid a separate schema migration later.

## 10. UI Summary

### 10.1 User-Facing: AIUsageCard (Compact)

Displayed on every AI-enabled page. Shows:

- **Cost**: `$0.12 USD / $0.19 AUD`
- **Images**: `24 images processed`
- **Sessions**: `8 import sessions`
- **Date context subtitle**: Matches the page's active filter (e.g., "March 2026" on expenses, "FY 2025-2026" on bank assets)
- **Empty state**: `$0.00` when no usage exists

### 10.2 Dashboard (/home): Per-Feature Cards

Current calendar month scope. Separate card per feature:

- **Expenses AI** — EXPENSE usage this month
- **Bank Assets AI** — BANK_ASSET usage this month
- **Stocks AI** — STOCK usage this month (placeholder)

### 10.3 Admin: Overview Table

| Column           | Description                   |
| ---------------- | ----------------------------- |
| User Name        | From `User.name`              |
| Email            | From `User.email`             |
| Total Cost (USD) | Sum of `estimatedCostUSD`     |
| Total Cost (AUD) | Converted at current rate     |
| Total Tokens     | Sum of `totalTokens`          |
| Images           | Count of distinct `imageId`   |
| Sessions         | Count of distinct `sessionId` |

Date range filter at the top (default: current calendar month).

### 10.4 Admin: User Drill-Down Table

| Column            | Description                                          |
| ----------------- | ---------------------------------------------------- |
| Category          | `importType` label (Expenses / Bank Assets / Stocks) |
| Cost (USD + AUD)  | Sum per category                                     |
| Prompt Tokens     | Sum of `promptTokens`                                |
| Completion Tokens | Sum of `completionTokens`                            |
| Total Tokens      | Sum of `totalTokens`                                 |
| Images            | Count of distinct `imageId`                          |
| Sessions          | Count of distinct `sessionId`                        |

Breadcrumb: `AI Spend > {User Name}`

## 11. Phased Delivery

| Phase                          | Scope                                                                                           | Dependencies |
| ------------------------------ | ----------------------------------------------------------------------------------------------- | ------------ |
| **P1: Logging Infrastructure** | Prisma model, pricing constants, capture `usage` from AI SDK, write `AIUsageLog` in parse route | None         |
| **P2: Exchange Rate Service**  | FX service with cache + fallback                                                                | None         |
| **P3: tRPC Queries**           | User + admin procedures, `adminProcedure` middleware                                            | P1           |
| **P4: User AI Usage Cards**    | `AIUsageCard` component, placement on Expense / Bank / Stocks pages                             | P2, P3       |
| **P5: Dashboard Cards**        | Per-feature cards on `/home`                                                                    | P4           |
| **P6: Admin Section**          | Overview page, drill-down page, SideNav link                                                    | P3           |

## 12. Verification Criteria

1. After an AI import, an `AIUsageLog` record exists with non-zero `promptTokens`, `completionTokens`, and `estimatedCostUSD`.
2. The expense page shows an AIUsageCard reflecting usage within the page's fiscal year filter.
3. Bank Assets and Stocks pages show AIUsageCard with `$0.00` (until their AI imports are active).
4. Dashboard `/home` shows three per-feature cards scoped to the current calendar month.
5. Admin navigating to `/settings/ai-usage` sees all users with aggregated spend.
6. Admin clicking a user row sees per-category breakdown with full token detail.
7. Non-admin navigating to `/settings/ai-usage` gets a FORBIDDEN error.
8. All cost displays show both USD and AUD amounts.
9. FX rate falls back to hardcoded value if API is unreachable.
10. `pnpm run build` completes with zero errors.

## 13. References

- [Vercel AI SDK — `generateText` usage object](https://sdk.vercel.ai/docs/ai-sdk-core/generating-text#usage-information)
- [OpenAI GPT-4o pricing](https://openai.com/api/pricing/)
- [tRPC Middleware](https://trpc.io/docs/server/middlewares)
- [open.er-api.com — Free Exchange Rate API](https://open.er-api.com/)
- [Prisma `@db.Money` type](https://www.prisma.io/docs/orm/reference/prisma-schema-reference#money)
- [Next.js App Router — Route Groups](https://nextjs.org/docs/app/building-your-application/routing/route-groups)
