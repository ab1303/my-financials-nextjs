# Context: Preferred Currency Display

## Overview

This document inventories all files relevant to the Preferred Currency Display feature. The goal is to wire the existing `User.preferredCurrency` database field through to all monetary display sites across the app, which currently hardcode `'AUD'`.

---

## 1. Hardcoded AUD Locations (9 files)

### Shared Transaction Components

| File | Line | Pattern |
|------|------|---------|
| `src/components/transactions/TransactionRow.tsx` | 35 | `new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value)` inside local `formatCurrency()` |
| `src/components/transactions/ReimbursementSubRow.tsx` | 11 | `new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value)` inside local `formatCurrency()` |

### Cashflow — Donations

| File | Line | Pattern |
|------|------|---------|
| `src/app/(authorized)/cashflow/donations/_components/LinkTransactionsDrawer.tsx` | 51 | `currency: 'AUD'` inside local `formatCurrency()` (lines 49–52) |

### Cashflow — Bank Interest

| File | Line | Pattern |
|------|------|---------|
| `src/app/(authorized)/cashflow/bank-interest/InterestCreditsTable.tsx` | 17 | `new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value)` inside local `formatCurrency()` |
| `src/app/(authorized)/cashflow/bank-interest/page.tsx` | 33 | `currency: 'AUD'` inside local `formatCurrency()` (lines 30–35) |
| `src/app/(authorized)/cashflow/bank-interest/_components/CleanseDonationDrawer.tsx` | 64 | `new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount)` inside local `formatCurrency()` |
| `src/app/(authorized)/cashflow/bank-interest/_components/CleansingDonationsList.tsx` | 11 | `new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value)` inside local `formatCurrency()` |

### Assets

| File | Line | Pattern |
|------|------|---------|
| `src/app/(authorized)/assets/_components/NetWorthChart.tsx` | 31 | `currency: 'AUD'` inside local `formatAudCurrency()` (lines 28–34) |
| `src/app/(authorized)/assets/_components/AssetSummaryCards.tsx` | 17 | `currency: 'AUD'` inside local `formatAudCurrency()` (lines 14–20) |

**Note:** All 9 components are **Client Components** (`"use client"`) — they contain interactivity or are children of client subtrees. This drives the decision to inject currency via React Context rather than direct server props.

---

## 2. Existing Gold-Standard: Stocks Multi-Currency

### Formatting Utility

**File:** `src/utils/stock-asset-calculations.ts` — lines 143–152

```typescript
export function formatCurrency(
  value: number,
  currency: CurrencyEnumType,
): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
```

**Limitation:** Locale is hardcoded to `'en-AU'` even when `currency` is `USD`. The new shared utility must map currency to the correct locale (`en-AU` → AUD, `en-US` → USD).

Additional helpers in same file:
- `formatPrice(value, currency)` — 4 decimal places
- `formatPL(value, currency)` — profit/loss with sign prefix
- `formatPercentage(value)` — percentage formatting

### Stock Holding Form Default

**File:** `src/app/(authorized)/assets/stocks/HoldingFormModal.tsx` — line 112

```typescript
currency: 'AUD',  // default for new holdings
```

This is the Phase 5 target: default to `preferredCurrency` from the user profile instead.

---

## 3. User Profile — preferredCurrency Field

### Prisma Schema

**File:** `prisma/schema.prisma`

```prisma
model User {
  // ...
  preferredCurrency     CurrencyEnumType?  @default(AUD)
  // ...
}

enum CurrencyEnumType {
  AUD
  USD
}
```

### tRPC Router

**File:** `src/server/trpc/router/user-profile.ts` — lines 11–13

```typescript
getProfile: protectedProcedure.query(async ({ ctx }) => {
  return profileService.getProfile(ctx.prisma, ctx.session.user.id);
}),
```

**Service:** `src/server/services/user-profile/user-profile.service.ts`

`getProfile` returns a `UserProfileData` object which includes:

```typescript
preferredCurrency: CurrencyEnumType | null;
```

---

## 4. (authorized) Layout

**File:** `src/app/(authorized)/layout.tsx` (28 lines total)

```typescript
import * as React from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import PageLoading from '@/components/PageLoading';
import AppShell from '@/components/AppShell';
import { UserProvider } from './UserProvider';

export default async function AuthorizedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect('/auth/login');
  const isUser = !!session?.user;
  if (!isUser) return <PageLoading />;

  return (
    <AppShell user={session.user}>
      <UserProvider user={session.user}>{children}</UserProvider>
    </AppShell>
  );
}
```

**Key:** This is a **Server Component** that already fetches session data. It is the ideal place to also fetch `preferredCurrency` and inject it into a `CurrencyProvider`.

### Existing UserProvider

**File:** `src/app/(authorized)/UserProvider.tsx` — a Client Component that provides `session.user` to client-side consumers via React Context. The `CurrencyProvider` will follow the same pattern.

---

## 5. Missing Files (To Be Created)

| File | Status |
|------|--------|
| `src/utils/currency.ts` | ❌ Does not exist |
| `src/context/CurrencyContext.tsx` | ❌ Does not exist (`src/context/` directory does not exist) |

---

## 6. Out-of-Scope: Stocks Module

The stocks module already handles multi-currency per holding correctly. Each `StockHolding` record stores its own `currency: CurrencyEnumType`. Stocks summary cards display separate **🇦🇺 AUD Holdings** and **🇺🇸 USD Holdings** sections. The `formatCurrency` in `stock-asset-calculations.ts` is used throughout stocks components.

**Stocks is NOT changed by this feature** — except Phase 5 which updates the new-holding form default to use `preferredCurrency`.
