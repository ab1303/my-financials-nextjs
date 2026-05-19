# Snapshot All Banks Display — High Level Design

## Problem & Solution

Currently the Bank Assets page only renders accordion sections for banks that already appear in the selected snapshot's totals. A user who has configured ANZ but hasn't added any ANZ accounts to a historical snapshot cannot discover how to add them — ANZ is simply invisible.

The solution is to render **all user-configured banks** in the accordion list, not just those in the snapshot totals. Banks with no entries in the current snapshot display an empty state with an "Add Account" CTA, allowing the user to extend the snapshot coverage without creating a new one.

---

## Architecture Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | **Frontend-only change** | All required data (`banks`, `allBankAccounts`, `snapshot`) is already fetched. No new tRPC endpoints, schema changes, or services needed. |
| 2 | **Iterate over `banks` instead of `totals.banks`** | `banks` (from `getBusinessesByType`) is the authoritative list of all user banks. `totals.banks` is a derived subset. Switching the iteration source gives full coverage with minimal code change. |
| 3 | **Merge totals data into the banks list** | Build a lookup map `totalsMap: Map<bankId, BankTotalSummary>` from `totals.banks`. For each bank, check if it's in the map. If yes, render accounts. If no, render empty state. |
| 4 | **Reuse existing add-entry UI** | The inline `addingEntryForBankId` state + `AppCreatableSelect` form already works. Empty-state banks simply trigger the same flow via the "Add Account" button. |
| 5 | **Show all banks only when a snapshot is selected** | Without a snapshot there's nothing to add entries to. When no snapshot exists, the existing "No snapshots recorded" empty state still shows. |
| 6 | **Distinguish empty-state banks visually** | Banks not in the snapshot render with muted/dashed styling and a "No accounts tracked in this snapshot" label to clarify the state to the user. |

---

## Component Changes

### `BankAssetsClient.tsx`

| Change | Detail |
|---|---|
| New derived data | `totalsMap` — `useMemo` that converts `totals?.banks` array into `Map<bankId, BankTotalSummary>` |
| Render source | Change accordion iteration from `totals.banks.map(...)` to `banks.map(bank => ...)` |
| Per-bank rendering | If `totalsMap.has(bank.id)` → existing account rows + add entry form. Else → empty state row + add entry form. |
| Empty state content | "No accounts tracked in this snapshot" label + "Add Account" button that triggers existing `handleOpenAddEntry(bank.bankId)` |
| No new state | All existing state (`addingEntryForBankId`, `newEntryAccountId`, etc.) is reused unchanged |

---

## Data Model Changes

None. No schema migrations required.

---

## Success Criteria

| # | Criterion |
|---|---|
| 1 | All user-configured banks appear in the accordion when a snapshot is selected |
| 2 | Banks without entries in the snapshot show an empty state with "Add Account" CTA |
| 3 | Clicking "Add Account" on an empty-state bank opens the inline add-entry form |
| 4 | After adding an account, the bank section refreshes showing the new entry and updated total |
| 5 | Banks with entries continue to render exactly as before |
| 6 | `pnpm run build` passes with no TypeScript errors |

---

## Out of Scope

| Item | Reason |
|---|---|
| Banks with zero configured accounts | Show "No accounts configured" message; adding accounts belongs to Settings flow |
| Sorting/ordering of banks | Existing alpha sort by bankName is retained |
| Stock assets (PortfolioSnapshot) | Separate feature, separate client component |
| Batch "add all banks to snapshot" | Not needed; per-bank Add Account is sufficient |
