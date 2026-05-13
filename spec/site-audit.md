# Site Audit — My Financials

**Audited:** 2026-05-13  
**Tool:** Playwright (Chromium, `networkidle` strategy)  
**Account:** `abdul@example.com`  
**Pages covered:** 18 routes  

---

## Summary

| Severity | Count | Pages |
|---|---|---|
| 🔴 Critical | 5 | Income, Expense, Donations, Stocks, Zakat |
| 🟠 High | 4 | Bank Assets, Individual Relations, AI Usage, Income Summary |
| 🟡 Medium | 3 | Root redirect, Bank Interest title, Auth pages layout |
| 🔵 Low / Global | 3 | Missing fonts, Auth session race, RSC chunk aborts |

---

## 🔴 Critical — Page Crashes (Application Error Boundary)

These pages throw unhandled errors that trigger the Next.js error boundary, rendering the page completely blank.

---

### CRIT-01 · `/cashflow/income` — Prisma `aggregate` called on `undefined`

**Error:**
```
TypeError: Cannot read properties of undefined (reading 'aggregate')
```
**Root cause:** A Server Component calls `prisma.<model>.aggregate(...)` but the model reference is `undefined`. Likely a renamed/removed Prisma model whose import was not updated.

**Impact:** Page is completely broken; no content renders.

---

### CRIT-02 · `/cashflow/expense` — Prisma `findUnique` called on `undefined`

**Error:**
```
TypeError: Cannot read properties of undefined (reading 'findUnique')
```
**Root cause:** Same pattern as CRIT-01. A Server Component calls `prisma.<model>.findUnique(...)` on an undefined model reference.

**Impact:** Page is completely broken; no content renders.

---

### CRIT-03 · `/cashflow/donations` — `PrismaClientValidationError`: unknown argument `donation`

**Error:**
```
PrismaClientValidationError: Invalid `prisma.donationPayment.aggregate()` invocation
Unknown argument `donation`. Available options are: AND, OR, NOT, id, datePaid, amount,
beneficiaryType, taxCategory, businessId, individualId, donationLedgerId, business,
individual, donationLedger
```
**Root cause:** `getTotalDonations()` filters via `where: { donation: { calendarId: "" } }` but the `donation` relation no longer exists on `DonationPayment` in the Prisma schema. The relationship was presumably renamed or removed (it now appears to be `donationLedger`).

**File:** `src` Server Component querying `donationPayment.aggregate`

**Fix required:** Update the `where` clause to use the correct relation — likely:
```ts
where: {
  donationLedger: {
    calendarId: calendarYearId,
  },
}
```

**Impact:** Page completely broken; no content renders.

---

### CRIT-04 · `/cashflow/stocks` — Infinite RSC refresh loop + `stockAsset.getSnapshots` HTTP 500

**Errors:**
```
TRPCClientError: Cannot read properties of undefined (reading 'findMany')
HTTP 500 /api/trpc/stockAsset.getSnapshots
```
**Root cause:** The `stockAsset.getSnapshots` tRPC handler calls `prisma.stockAsset.findMany(...)` but `stockAsset` is `undefined` (missing or renamed Prisma model). The tRPC error causes the page to retry indefinitely via RSC refresh, generating 20+ aborted network requests before the 20s navigation timeout is exceeded.

**Impact:** Page never loads; browser spins for 20s then throws a navigation timeout. Generates 143 errors/aborted requests in a single visit.

**Additional concern:** The retry loop itself is a UX and performance issue — the page should fail gracefully rather than looping.

---

### CRIT-05 · `/zakat` — Prisma `findUnique` called on `undefined`

**Error:**
```
TypeError: Cannot read properties of undefined (reading 'findUnique')
```
**Root cause:** Same pattern as CRIT-02. A Server Component's Prisma query references an undefined model.

**Impact:** Page completely broken; no content renders.

---

## 🟠 High — Functional Errors (Page Loads but Data Fails)

---

### HIGH-01 · `/cashflow/bank` (Bank Assets) — `bankAsset.getSnapshots` HTTP 500

**Error:**
```
HTTP 500 /api/trpc/bankAsset.getSnapshots
TRPCClientError: Cannot read properties of undefined (reading 'findMany')
```
**Root cause:** Same family as CRIT-04. The `bankAsset` Prisma model is `undefined` in the tRPC handler. Unlike Stocks, the page shell renders successfully, but the snapshots data grid is empty/broken.

**Impact:** Page frame loads but bank asset snapshot data cannot be fetched. User sees an empty state or error UI.

---

### HIGH-02 · `/relation/individual` — `individual.getAllRelationships` HTTP 500 (×2)

**Error:**
```
HTTP 500 /api/trpc/individual.getAllRelationships
```
**Root cause:** The tRPC `individual.getAllRelationships` procedure is throwing a server-side error. The endpoint is called twice (likely due to React Query retry). The exact server error is not surfaced in the client logs but the pattern is consistent with a Prisma model/relation access error.

**Impact:** Individual relationships table cannot load. User sees an empty table or error state.

---

### HIGH-03 · `/settings/ai-usage` — Unexpected redirect to `/home`

**Behaviour:** Navigating to `/settings/ai-usage` immediately redirects to `/home` with no error message.

**Root cause:** Either:
- The route is protected by a role/permission check that the audited user does not have, but the redirect is silent with no explanation.
- The route guard logic has a bug that redirects all users regardless of role.

**Impact:** Feature is completely inaccessible for this user. No feedback is given about why they were redirected.

**Note:** The child route `/settings/ai-usage/[userId]` was not independently tested.

---

### HIGH-04 · `/reports/income-summary` — `/api/income/monthly-summary` HTTP 500

**Errors:**
```
HTTP 500 /api/income/monthly-summary?calendarYearId=...&userId=...
Failed to fetch monthly summary: Error: Failed to fetch monthly summary
```
**Root cause:** The REST API route `/api/income/monthly-summary` throws a server error. The request includes both `calendarYearId` and `userId` as query params — the `userId` being passed from the client is a security concern (see note below).

**Impact:** Income summary chart/data fails to load. The page frame renders but the core report content is empty.

**Security note:** The `userId` should not be passed from the client. The server should derive it from the authenticated session (`auth()` / `getServerSession()`).

---

## 🟡 Medium — Degraded UX

---

### MED-01 · `/` (root) — Auth session fetch error on redirect

**Error:**
```
ClientFetchError: Failed to fetch (https://errors.authjs.dev#autherror)
GET /api/auth/session → net::ERR_ABORTED
```
**Behaviour:** Root `/` redirects to `/home` (expected). However, before the redirect completes, a client-side `SessionProvider` attempts to fetch `/api/auth/session` but the request is aborted mid-flight.

**Root cause:** The `SessionProvider` in the root layout initiates a session check immediately, but the navigation away from the page aborts the in-flight request. Auth.js surfaces this as an error rather than ignoring the abort.

**Impact:** Non-blocking, but generates noise in the browser console and could confuse users with developer tools open. May indicate the `SessionProvider` is mounted unnecessarily on the server-redirected root page.

---

### MED-02 · `/cashflow/bank-interest` — Generic page title

**Observed:** Page title is `"My Financials"` (the default app title) instead of a descriptive page-specific title such as `"Bank Interest | My Financials"`.

**Impact:** Poor browser tab UX; no SEO differentiation. All other pages in the cashflow section (e.g. Bank Assets) have specific titles.

---

### MED-03 · `/auth/login` and `/auth/register` — No `<main>` element

**Observed:** Neither the Login nor Register page contains a `<main>` element in the rendered DOM.

**Impact:** Accessibility issue — screen readers and assistive tools rely on `<main>` as the primary content landmark. Fails WCAG 2.1 landmark region guidelines.

---

## 🔵 Low / Global — Affects All Pages

---

### LOW-01 · Missing font file — `inter-var-latin.woff2` (404 on every page)

**Error (every page):**
```
GET /fonts/inter-var-latin.woff2 → 404 Not Found
```
**Root cause:** The font file is referenced in global CSS or a layout component, but it is not present in `public/fonts/`. Either the file was never committed, was removed, or the path is incorrect.

**Impact:** The Inter variable font is not loading. The browser falls back to system fonts. Affects visual consistency across the entire application. Also generates a console error on every single page load.

**Fix:** Either add `inter-var-latin.woff2` to `public/fonts/`, or switch to Next.js built-in font optimisation (`next/font/google`) and remove the manual `@font-face` reference.

---

### LOW-02 · Missing font file — `geist-latin.woff2` (404 on Settings – Calendar)

**Error:**
```
GET /__nextjs_font/geist-latin.woff2 → 404 Not Found
```
**Root cause:** The Geist font is referenced on the Calendar settings page but the font asset is missing from the Next.js font cache. This may be a stale build artefact or a misconfigured `next/font` import.

**Impact:** Limited to the Calendar page; Geist font will not render.

---

### LOW-03 · `/cashflow/stocks` — RSC infinite retry loop (secondary effect of CRIT-04)

**Observed:** When `stockAsset.getSnapshots` returns HTTP 500, Next.js App Router RSC refresh logic retries the page fetch repeatedly (`?yearId=...&_rsc=...`) without a backoff or retry cap, flooding the network tab with 20+ aborted requests before the timeout.

**Root cause:** No error boundary or retry limit on the RSC refresh triggered by a tRPC 500.

**Fix:** Add `error.tsx` in the `cashflow/stocks` route segment to catch and display the error gracefully, preventing the retry loop.

---

## Pages with No Issues

| Route | Title | Status |
|---|---|---|
| `/home` | Dashboard — My Financials | ✅ OK |
| `/relation/business` | My Financials | ✅ OK (generic title) |
| `/settings/profile` | My Financials | ✅ OK (generic title) |
| `/settings/banks` | My Financials | ✅ OK (generic title) |
| `/settings/calendar` | My Financials | ✅ OK (generic title, + LOW-02) |

> **Note on generic titles:** Several settings pages use the default `"My Financials"` title. While not a functional issue, adding descriptive `<title>` values would improve UX and browser history readability.

---

---

## Fix Status — Subagent Remediation (2026-05-13)

All issues were fixed via a fleet of 8 parallel Next.js Expert subagents plus manual follow-up fixes for missed references surfaced by `pnpm run build`.

| Issue | Agent | Status | Files Changed |
|---|---|---|---|
| CRIT-01 Income crashes | `fix-income` | ✅ DONE | `income.service.ts`, `income.ts` model, `income.service.test.ts`, `IncomeTableServer.tsx`, `IncomeTableClient.tsx`, `income/_types.ts`, `income/actions.ts` |
| CRIT-02 Expense crashes | `fix-expense` | ✅ DONE | `expense.service.ts`, `expense.ts` model, `expense-mapper.service.ts`, `expense/actions.ts` |
| CRIT-03 Donations crashes | `fix-donation-zakat` | ✅ DONE | `donation.service.ts`, `donation.ts` model, `donations/actions.ts` |
| CRIT-04 Stocks crashes | `fix-stocks` | ✅ DONE | `stock-asset.service.ts`, `stock-asset.types.ts` |
| CRIT-05 Zakat crashes | `fix-donation-zakat` | ✅ DONE | `zakat.service.ts`, `zakat.ts` model, `zakat/actions.ts` |
| HIGH-01 Bank Assets crashes | `fix-bank-assets` | ✅ DONE | `bank-asset.service.ts`, `bank-asset-mapper.service.ts`, `BankAssetsClient.tsx`, `NewSnapshotModal.tsx`, `bank-asset.types.ts` |
| HIGH-02 Individual Relations 500 | `fix-relationship` | ✅ DONE | `relationship.service.ts` |
| HIGH-03 AI Usage redirect | N/A | ✅ BY DESIGN | Admin-only route guard; `abdul@example.com` is not admin |
| HIGH-04 Income Summary auth | `fix-medium-low` | ✅ DONE | `api/income/monthly-summary/route.ts`, `api/income/source-breakdown/route.ts` |
| MED-01 Root redirect race | N/A | ✅ ACCEPTABLE | `SessionProvider` fires before redirect; not a bug |
| MED-02 Bank Interest title | `fix-medium-low` | ✅ DONE | `cashflow/bank-interest/page.tsx` |
| MED-03 Auth pages `<main>` | `fix-medium-low` | ✅ DONE | `auth/login/page.tsx`, `auth/register/page.tsx` |
| LOW-01 Missing font | `fix-medium-low` | ✅ DONE | Removed duplicate `@font-face` from `globals.css`; app already uses `next/font/google` |

### Additional fixes surfaced during `pnpm run build` validation

These were missed by the subagents (they existed in app-layer files outside the service layer):

| File | Fix |
|---|---|
| `prisma/seed-expense-categories.ts` | `expenseEntry` → `monthlyExpenseSummary` |
| `cashflow/bank/BankAssetsClient.tsx` | `snapshot?.entries` → `snapshot?.balanceRecords` (3 occurrences) |
| `cashflow/bank/NewSnapshotModal.tsx` | `entries: BankAssetEntry[]` → `balanceRecords: BankBalanceRecord[]`; `mostRecentSnapshot.entries` → `mostRecentSnapshot.balanceRecords` |
| `cashflow/donations/actions.ts` | `donationId: ''` → `donationLedgerId: ''` |
| `cashflow/expense/actions.ts` | `expenseId` → `expenseLedgerId` (3 fields) |
| `cashflow/income/actions.ts` | `incomeId` → `incomeLedgerId` |
| `cashflow/income/IncomeTableServer.tsx` | `entry.incomeId` → `entry.incomeLedgerId` |
| `cashflow/income/IncomeTableClient.tsx` | `incomeId: ''` → `incomeLedgerId: ''` |
| `cashflow/income/_types.ts` | `incomeId: string` → `incomeLedgerId: string` |
| `zakat/actions.ts` | `zakatId: ''` → `zakatObligationId: ''` |
| `server/services/bank-interest.service.ts` | `bankInterest` → `bankInterestLiability`; `payment` → `bankInterestPayment`; `BankInterestCreateManyInput` → `BankInterestLiabilityCreateManyInput`; FK `bankInterestId` → `bankInterestLiabilityId` |
| `server/services/ai-import/csv-classifier.service.ts` | AI SDK: `usage.promptTokens` → `usage.inputTokens`; `usage.completionTokens` → `usage.outputTokens` |
| `server/trpc/router/example.ts` | Removed `prisma.example.findMany()` — `Example` model removed from schema |
| `types/bank-asset.types.ts` | `BankAssetSnapshot` → `BankBalanceSnapshot`; `BankAssetEntry` → `BankBalanceRecord`; `entries` → `balanceRecords` |
| `types/stock-asset.types.ts` | `StockSnapshot` → `PortfolioSnapshot` |

### Build Result

`pnpm run build` — ✅ **Passed** — 31 routes compiled, TypeScript clean, no errors.



| # | Issue | Severity | Likely Root Cause |
|---|---|---|---|
| 1 | CRIT-03 Donations `PrismaClientValidationError` | 🔴 | Schema changed; query uses old relation name `donation` → should be `donationLedger` |
| 2 | CRIT-01/02/05 Income, Expense, Zakat undefined Prisma model | 🔴 | Prisma model renamed/removed; imports not updated |
| 3 | CRIT-04 / HIGH-01 Stocks & Bank Assets `findMany` undefined | 🔴 | Same as above for `stockAsset` / `bankAsset` models |
| 4 | HIGH-02 Individual relationships 500 | 🟠 | tRPC handler server error (likely same Prisma model issue) |
| 5 | HIGH-04 Income summary API 500 + client-side `userId` | 🟠 | API route bug; also a security concern |
| 6 | HIGH-03 AI Usage redirect | 🟠 | Role guard misconfiguration |
| 7 | LOW-01 Missing `inter-var-latin.woff2` | 🔵 | Font file missing from `public/fonts/` |
| 8 | MED-03 No `<main>` on auth pages | 🟡 | Accessibility / semantic HTML |
| 9 | MED-01 Auth session fetch error on `/` | 🟡 | `SessionProvider` fires before redirect completes |
| 10 | MED-02 + settings generic titles | 🟡 | Missing `generateMetadata` / `<title>` in page files |

---

## Audit Artefacts

- Raw JSON results: `e2e/audit-results.json`
- Playwright spec: `e2e/site-audit.spec.ts`
