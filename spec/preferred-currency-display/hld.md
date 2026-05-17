# HLD: Preferred Currency Display

## Problem Statement

The `User.preferredCurrency` profile field (`AUD` | `USD`, default `AUD`) is saved but never read. Nine files across the app hardcode `currency: 'AUD'` in `Intl.NumberFormat` calls, meaning users who select `USD` see no change in how monetary amounts are formatted.

This feature wires `preferredCurrency` through to all monetary display sites as a **pure display preference** — no stored data is changed, no currency conversion is performed.

---

## Goals

1. Respect the user's `preferredCurrency` preference in all monetary display formatting.
2. Eliminate all hardcoded `'AUD'` instances in non-stock components.
3. Introduce a single shared `formatCurrency` utility with correct locale per currency.
4. Make currency preference available to Client Components without per-component network calls.
5. Default new stock holding form currency to `preferredCurrency`.

## Non-Goals

- Currency conversion between AUD and USD.
- Changing stored transaction data or asset values.
- Modifying the stocks module multi-currency-per-holding logic.
- Backend API or Prisma schema changes (field already exists).

---

## Architecture

### 1. Shared Currency Utility (`src/utils/currency.ts`)

A new dedicated utility replaces the 9 duplicated inline formatters and extends the existing `formatCurrency` in `stock-asset-calculations.ts` with correct locale mapping:

```
AUD → locale 'en-AU', symbol '$' (Australian)
USD → locale 'en-US', symbol '$' (American)
```

The existing `formatCurrency` in `stock-asset-calculations.ts` will be updated to delegate to this shared utility to keep a single source of truth.

### 2. Currency Preference Threading: React Context at Layout Level

**Chosen approach: React Context Provider in the `(authorized)` layout.**

#### Option Analysis

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| A. Cookie | Available everywhere, zero-latency | Extra cookie write on profile save; coupling | Rejected |
| B. tRPC call per component | Simple, self-contained | N+1 network round-trips; loading states in each component | Rejected |
| C. Prop threading from Server Component | No extra fetch | Deep prop-drilling across layouts and page trees | Rejected |
| **D. React Context at layout level** | **Single fetch, available everywhere, consistent pattern** | **Requires a Provider Client Component** | **✅ Chosen** |

**Why Option D:**
- The `(authorized)` layout is already a Server Component that fetches session data.
- It already wraps children with `<UserProvider>` — the `<CurrencyProvider>` follows exactly the same pattern.
- One profile query per page navigation; zero additional round-trips for components.
- Client Components consume a simple `useCurrency()` hook — no prop drilling.

#### Data Flow

```
(authorized)/layout.tsx  [Server Component]
  ├── auth()                        → session
  ├── profileService.getProfile()   → { preferredCurrency: 'USD' | 'AUD' }
  └── <CurrencyProvider currency={preferredCurrency}>
        └── {children}              → all authorized pages
              └── <SomeClientComponent />
                    └── useCurrency() → 'USD'
                          └── formatCurrency(amount, 'USD') → '$1,234.56'
```

### 3. CurrencyContext Shape

```typescript
// src/context/CurrencyContext.tsx
interface CurrencyContextValue {
  currency: CurrencyEnumType;
}

// Hook
function useCurrency(): CurrencyEnumType

// Provider  
function CurrencyProvider({
  currency,
  children,
}: {
  currency: CurrencyEnumType;
  children: React.ReactNode;
}): JSX.Element
```

**Fallback:** Context defaults to `'AUD'` so components never break if consumed outside the provider.

### 4. Component Update Pattern

Each of the 9 hardcoded-AUD Client Components will:

1. Import `useCurrency` hook.
2. Import `formatCurrency` from `src/utils/currency.ts`.
3. Remove their local inline formatter function.
4. Call `const currency = useCurrency()` at the component root.
5. Replace all `new Intl.NumberFormat('en-AU', { ..., currency: 'AUD' }).format(v)` calls with `formatCurrency(v, currency)`.

---

## Data Model

No schema changes. `CurrencyEnumType` enum and `User.preferredCurrency` field already exist in `prisma/schema.prisma`.

```prisma
enum CurrencyEnumType {
  AUD
  USD
}

model User {
  preferredCurrency  CurrencyEnumType?  @default(AUD)
}
```

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| New `src/utils/currency.ts` (not modifying `stock-asset-calculations.ts` main function) | Stocks utility is stocks-specific; shared utility lives in general `utils/`. Stocks formatters updated to delegate. |
| Locale mapping in shared utility | `en-AU` for AUD, `en-US` for USD — ensures correct thousands/decimal separators and currency symbol placement. |
| CurrencyProvider defaults to `AUD` | Graceful degradation; matches existing behaviour if context is missing. |
| Fetch profile in layout (not in `auth()`) | `auth()` returns session user which does not include `preferredCurrency`; a separate `getProfile` call is needed. |
| Stocks Phase 5 is separate | Low-risk, self-contained; isolated to the new-holding form default value. |

---

## Affected Files Summary

### New Files
- `src/utils/currency.ts`
- `src/context/CurrencyContext.tsx`

### Modified Files
- `src/app/(authorized)/layout.tsx` — add profile fetch + CurrencyProvider
- `src/utils/stock-asset-calculations.ts` — delegate `formatCurrency` to shared utility
- 9 hardcoded-AUD components (see context.md §1)
- `src/app/(authorized)/assets/stocks/HoldingFormModal.tsx` — Phase 5 default currency

---

## Out of Scope

- Stocks module multi-currency display (already correct per-holding).
- Currency conversion rates or exchange rate API.
- Persisting currency preference changes (already handled by existing profile settings UI).
- Mobile/native app considerations.
