# LLD: Preferred Currency Display

## Phase Map

| Phase | Title | Dependencies |
|-------|-------|-------------|
| 1 | Shared Currency Utility | None |
| 2 | CurrencyContext Provider & Hook | Phase 1 |
| 3 | Wire CurrencyProvider into (authorized) Layout | Phase 2 |
| 4 | Update 9 Hardcoded-AUD Components | Phase 3 |
| 5 | Stock Holding Form Default Currency | Phase 3 |

---

## Phase 1 — Shared Currency Utility

**Goal:** Create `src/utils/currency.ts` with a `formatCurrency` function that maps `CurrencyEnumType` to the correct locale, replacing all inline `Intl.NumberFormat` duplicates.

### File: `src/utils/currency.ts` (new)

```typescript
import { type CurrencyEnumType } from '@prisma/client';

const CURRENCY_LOCALE_MAP: Record<CurrencyEnumType, string> = {
  AUD: 'en-AU',
  USD: 'en-US',
};

/**
 * Format a monetary value using the user's preferred currency.
 * Produces locale-correct separators and currency symbol placement.
 */
export function formatCurrency(
  value: number,
  currency: CurrencyEnumType,
): string {
  const locale = CURRENCY_LOCALE_MAP[currency] ?? 'en-AU';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
```

**Key contract:**
- Input: `value: number`, `currency: CurrencyEnumType`
- Output: locale-formatted string (e.g., `'$1,234.56'` for AUD; `'$1,234.56'` for USD but with US formatting)
- Falls back to `'en-AU'` locale if an unknown currency is passed

### Update: `src/utils/stock-asset-calculations.ts`

Replace the existing `formatCurrency` implementation (lines 143–152) to delegate to the shared utility:

```typescript
import { formatCurrency as sharedFormatCurrency } from '@/utils/currency';

// Replace existing body:
export function formatCurrency(
  value: number,
  currency: CurrencyEnumType,
): string {
  return sharedFormatCurrency(value, currency);
}
```

This preserves the stocks module's public API while eliminating duplication.

### Unit Tests: `src/utils/__tests__/currency.test.ts` (new)

```typescript
import { describe, it, expect } from 'vitest';
import { formatCurrency } from '@/utils/currency';

describe('formatCurrency', () => {
  it('formats AUD with en-AU locale', () => {
    expect(formatCurrency(1234.56, 'AUD')).toBe('$1,234.56');
  });

  it('formats USD with en-US locale', () => {
    expect(formatCurrency(1234.56, 'USD')).toBe('$1,234.56');
  });

  it('handles zero', () => {
    expect(formatCurrency(0, 'AUD')).toBe('$0.00');
  });

  it('handles negative values', () => {
    expect(formatCurrency(-500, 'AUD')).toBe('-$500.00');
  });

  it('always outputs 2 decimal places', () => {
    expect(formatCurrency(10, 'USD')).toBe('$10.00');
  });
});
```

---

## Phase 2 — CurrencyContext Provider & Hook

**Goal:** Create `src/context/CurrencyContext.tsx` — a React Context, a `CurrencyProvider` Client Component, and a `useCurrency()` hook.

### File: `src/context/CurrencyContext.tsx` (new)

```typescript
'use client';

import * as React from 'react';
import { type CurrencyEnumType } from '@prisma/client';

interface CurrencyContextValue {
  currency: CurrencyEnumType;
}

const CurrencyContext = React.createContext<CurrencyContextValue>({
  currency: 'AUD', // safe default — matches existing hardcoded behaviour
});

export function CurrencyProvider({
  currency,
  children,
}: {
  currency: CurrencyEnumType;
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => ({ currency }), [currency]);
  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyEnumType {
  return React.useContext(CurrencyContext).currency;
}
```

**Conventions followed:**
- `'use client'` — React Context providers must be Client Components
- `React.useMemo` prevents unnecessary re-renders when parent re-renders with same currency value
- Default context value is `'AUD'` — components outside the provider continue to behave as before

---

## Phase 3 — Wire CurrencyProvider into (authorized) Layout

**Goal:** Fetch `preferredCurrency` from the user profile in the Server Component layout and inject it into `<CurrencyProvider>`.

### Modified File: `src/app/(authorized)/layout.tsx`

```typescript
import * as React from 'react';
import { redirect } from 'next/navigation';

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import PageLoading from '@/components/PageLoading';
import AppShell from '@/components/AppShell';
import { UserProvider } from './UserProvider';
import { CurrencyProvider } from '@/context/CurrencyContext';

export default async function AuthorizedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect('/auth/login');
  }

  const isUser = !!session?.user;
  if (!isUser) return <PageLoading />;

  // Fetch preferredCurrency directly — avoids calling full tRPC stack from layout
  const userPrefs = await db.user.findUnique({
    where: { id: session.user.id },
    select: { preferredCurrency: true },
  });

  const preferredCurrency = userPrefs?.preferredCurrency ?? 'AUD';

  return (
    <AppShell user={session.user}>
      <UserProvider user={session.user}>
        <CurrencyProvider currency={preferredCurrency}>
          {children}
        </CurrencyProvider>
      </UserProvider>
    </AppShell>
  );
}
```

**Notes:**
- Uses `db` (Prisma client) directly — appropriate for a Server Component layout; avoids invoking the tRPC HTTP layer.
- `select: { preferredCurrency: true }` — minimal query, no over-fetching.
- Falls back to `'AUD'` if the user record has a null `preferredCurrency` (matches Prisma default).
- `db` import path follows T3 convention: `@/server/db`.

---

## Phase 4 — Update 9 Hardcoded-AUD Components

**Goal:** In each component, remove the local inline formatter and replace it with `useCurrency()` + shared `formatCurrency`.

### Change Pattern (apply to all 9 files)

**Before:**
```typescript
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(value);
}
```

**After:**
```typescript
import { useCurrency } from '@/context/CurrencyContext';
import { formatCurrency } from '@/utils/currency';

// Inside component function:
const currency = useCurrency();

// In JSX or render logic:
formatCurrency(value, currency)
```

### Per-File Changes

#### 1. `src/components/transactions/TransactionRow.tsx`
- Remove local `formatCurrency` at line 35
- Add imports: `useCurrency`, `formatCurrency`
- Call `const currency = useCurrency()` in component body
- Replace all usages of local formatter

#### 2. `src/components/transactions/ReimbursementSubRow.tsx`
- Remove local `formatCurrency` at line 11
- Add imports: `useCurrency`, `formatCurrency`
- Call `const currency = useCurrency()` in component body
- Replace all usages of local formatter

#### 3. `src/app/(authorized)/cashflow/donations/_components/LinkTransactionsDrawer.tsx`
- Remove local `formatCurrency` (lines 49–52)
- Add imports: `useCurrency`, `formatCurrency`
- Call `const currency = useCurrency()` in component body
- Replace all usages of local formatter

#### 4. `src/app/(authorized)/cashflow/bank-interest/InterestCreditsTable.tsx`
- Remove local `formatCurrency` at line 17
- Add imports: `useCurrency`, `formatCurrency`
- Call `const currency = useCurrency()` in component body
- Replace all usages of local formatter

#### 5. `src/app/(authorized)/cashflow/bank-interest/page.tsx`
- Remove local `formatCurrency` (lines 30–35)
- Add imports: `useCurrency`, `formatCurrency`
- Call `const currency = useCurrency()` in component body
- Replace all usages of local formatter
- **Note:** Verify this file has `'use client'` or is nested inside a Client Component before adding the hook; if it is a Server Component, extract the formatted value into a child Client Component instead.

#### 6. `src/app/(authorized)/cashflow/bank-interest/_components/CleanseDonationDrawer.tsx`
- Remove local `formatCurrency` at line 64
- Add imports: `useCurrency`, `formatCurrency`
- Call `const currency = useCurrency()` in component body
- Replace all usages of local formatter

#### 7. `src/app/(authorized)/cashflow/bank-interest/_components/CleansingDonationsList.tsx`
- Remove local `formatCurrency` at line 11
- Add imports: `useCurrency`, `formatCurrency`
- Call `const currency = useCurrency()` in component body
- Replace all usages of local formatter

#### 8. `src/app/(authorized)/assets/_components/NetWorthChart.tsx`
- Remove local `formatAudCurrency` (lines 28–34)
- Add imports: `useCurrency`, `formatCurrency`
- Call `const currency = useCurrency()` in component body
- Replace all usages of `formatAudCurrency` with `formatCurrency(v, currency)`

#### 9. `src/app/(authorized)/assets/_components/AssetSummaryCards.tsx`
- Remove local `formatAudCurrency` (lines 14–20)
- Add imports: `useCurrency`, `formatCurrency`
- Call `const currency = useCurrency()` in component body
- Replace all usages of `formatAudCurrency` with `formatCurrency(v, currency)`

---

## Phase 5 — Stock Holding Form Default Currency

**Goal:** Default new stock holding currency to the user's `preferredCurrency` instead of hardcoded `'AUD'`.

### Modified File: `src/app/(authorized)/assets/stocks/HoldingFormModal.tsx`

The `HoldingFormModal` is a Client Component. It receives props from its parent. Two approaches:

**Option A — Pass `defaultCurrency` prop (preferred):**

The parent Server Component fetches `preferredCurrency` and passes it down as a prop to `HoldingFormModal`.

```typescript
// Parent Server Component (e.g., stocks page)
const userPrefs = await db.user.findUnique({
  where: { id: session.user.id },
  select: { preferredCurrency: true },
});
const defaultCurrency = userPrefs?.preferredCurrency ?? 'AUD';

<HoldingFormModal defaultCurrency={defaultCurrency} ... />
```

```typescript
// HoldingFormModal.tsx — add to props interface
interface HoldingFormModalProps {
  // ...existing props
  defaultCurrency: CurrencyEnumType;
}

// In useForm defaultValues (line 112):
currency: defaultCurrency,  // was: currency: 'AUD'
```

**Option B — Use `useCurrency()` hook (simpler, reuses Phase 3):**

Since `CurrencyProvider` wraps all authorized pages after Phase 3, `HoldingFormModal` can call `useCurrency()` directly:

```typescript
import { useCurrency } from '@/context/CurrencyContext';

// Inside HoldingFormModal component:
const preferredCurrency = useCurrency();

// In useForm defaultValues:
currency: preferredCurrency,  // was: currency: 'AUD'
```

**Recommended:** Option B — zero prop changes, consistent with Phase 4 pattern.

---

## TypeScript Interfaces

### `CurrencyContextValue`
```typescript
interface CurrencyContextValue {
  currency: CurrencyEnumType; // 'AUD' | 'USD'
}
```

### `formatCurrency` signature
```typescript
function formatCurrency(value: number, currency: CurrencyEnumType): string
```

### `CurrencyProvider` props
```typescript
interface CurrencyProviderProps {
  currency: CurrencyEnumType;
  children: React.ReactNode;
}
```

---

## Validation Checklist

After all phases complete:

- [ ] `pnpm run build` completes with zero TypeScript errors
- [ ] `pnpm run test` — unit tests for `formatCurrency` pass
- [ ] No remaining `currency: 'AUD'` literals outside of `stock-asset-calculations.ts` and `HoldingFormModal.tsx` (before Phase 5)
- [ ] Profile page: changing `preferredCurrency` to USD and navigating to cashflow/assets shows USD formatting
- [ ] Stocks module: still shows per-holding AUD/USD correctly (no regression)
- [ ] Components outside `<CurrencyProvider>` (if any) default to AUD gracefully

### Grep Verification Command
```bash
# Should return 0 results after Phase 4:
grep -r "currency: 'AUD'" src/components src/app/(authorized)/cashflow src/app/(authorized)/assets/_components
```
