# Add Holding Improvements: High-Level Design

## Document Info

- **Version**: 1.0
- **Date**: 2026-05-19
- **Status**: Ready for implementation
- **Feature Folder**: `spec/asset-stocks-tracking/add-holding-improvements/`

---

## Executive Summary

Two targeted UX improvements to the stock holdings workflow that eliminate repetitive data entry:

1. **Prefill from Previous Snapshot** — when creating a new snapshot, one click pre-populates all holdings from the most recent snapshot. User only updates current prices.
2. **Account Pre-selection** — when clicking "Add Holding" from a specific account's accordion, that account is already selected in the modal. Eliminates an extra dropdown interaction.

Both are **frontend-only changes** (no new endpoints, no schema changes, no migrations).

---

## Problem Statements

### P1: Prefill from Previous Snapshot
Users who take monthly portfolio snapshots must re-enter every holding from scratch each time: ticker, company, account, quantity, buy price, buy date, currency, planned term. Only `currentPrice` actually changes. This creates significant friction and error-prone data entry for users with large portfolios.

**Backend is ready** (`getMostRecentSnapshot` endpoint exists). Only the UI wiring is missing.

### P2: Account Pre-selection in Add Holding
The "Add Holding" button lives inside each account's accordion. When clicked, the `HoldingFormModal` opens with either the first brokerage account selected or no account selected — the user must manually pick the account they were just viewing. One redundant dropdown interaction per add.

---

## Feature Scope

### In Scope
- Prefill toggle button in `NewSnapshotModal` that loads and populates prior snapshot holdings
- Clearing `currentPrice`, `salePrice`, `saleDate`, `soldQuantity` on prefill (new snapshot starts fresh)
- `defaultAccountId` prop on `HoldingFormModal` to pre-seed the account dropdown in create mode
- Passing the accordion's `accountId` to `HoldingFormModal` from `StockAssetsClient`

### Out of Scope
- Selective prefill (choosing which holdings to copy) — too complex for this phase
- Prefill from a specific (non-latest) snapshot — user can always use "New Snapshot" and edit
- Snapshot date editing — tracked separately (low priority)
- Any backend changes

---

## Architecture

### Enhancement 1: Prefill (NewSnapshotModal)

```
User opens NewSnapshotModal
    │
    ├── tRPC query: getMostRecentSnapshot({}) fires on modal open (enabled: isOpen)
    │       └── Returns: StockSnapshotWithHoldings | null
    │
    └── User clicks "Prefill from previous snapshot" button (visible only if query returns data)
            └── reset({ snapshotDate: new Date(), holdings: mappedHoldings })
                    └── Fields: copy all except currentPrice=0, clear sale fields
```

**Why `reset()` not `replace()`?**  
`react-hook-form`'s `reset()` with new `defaultValues` replaces the entire form state atomically. This is cleaner than `remove()` + `append()` loops and avoids intermediate re-renders.

**Loading state**: While `getMostRecentSnapshot` is loading, the button shows a spinner/disabled. If no prior snapshot exists, the button is hidden.

### Enhancement 2: Account Pre-selection (StockAssetsClient → HoldingFormModal)

```
StockAssetsClient
    │
    ├── New state: addingToAccountId: string | null
    │
    └── "Add Holding" button in each account accordion:
            onClick={() => {
              setEditingHolding(null);
              setAddingToAccountId(account.id);   // ← NEW
              setIsHoldingFormModalOpen(true);
            }}

HoldingFormModal
    ├── New prop: defaultAccountId?: string
    │
    └── defaultValues (create mode):
            accountId: defaultAccountId || brokerageAccounts?.[0]?.id || ''
```

**On modal close**: `setAddingToAccountId(null)` cleared in `onClose` handler.

---

## Data Flow

### Prefill Flow
```
1. Modal opens → getMostRecentSnapshot fires
2. Server returns latest snapshot with all holdings
3. User clicks "Prefill from previous" button
4. Client maps holdings → CreateStockHoldingInput shape (clearing currentPrice/sale fields)
5. reset() replaces entire field array with mapped holdings
6. User reviews, updates currentPrice per row, changes snapshot date if needed
7. Submit → createSnapshot mutation fires as normal
```

### Account Pre-selection Flow
```
1. User expands Account A accordion in StockAssetsClient
2. User clicks "Add Holding" within Account A's panel
3. setAddingToAccountId("account-A-id") called before modal opens
4. HoldingFormModal renders with defaultAccountId="account-A-id"
5. Form initialises with accountId pre-set to Account A
6. On close: setAddingToAccountId(null)
```

---

## Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Prefill loads latest snapshot unconditionally (no year filter) | User wants their most recent real-world portfolio — year filter would miss recent data if they just switched years |
| D2 | `currentPrice` cleared to 0 on prefill | Price is the one field that changes per snapshot; defaulting to 0 forces the user to consciously set it (prevents stale prices being submitted silently) |
| D3 | Sale fields cleared on prefill | Sales are historical events tied to prior snapshots; they should not carry over to a new point-in-time capture |
| D4 | Prefill button hidden when no prior snapshot exists | Cleaner UX than a disabled button with tooltip; the modal is still fully usable for first-time entry |
| D5 | `addingToAccountId` lives in `StockAssetsClient`, not `HoldingFormModal` | Follows existing pattern: parent controls which account context to pass; modal is stateless about account selection |
| D6 | `defaultAccountId` only applies in create mode | Edit mode locks the account dropdown (`isDisabled={isEditMode}`) — defaultAccountId has no effect there |

---

## UI Wireframe

### NewSnapshotModal with Prefill Button

```
┌─ New Stock Snapshot ──────────────────────────────────────────┐
│ Record your current stock portfolio position                   │
│                                                                │
│ Snapshot Date: [2026-05-19]                                    │
│                                                                │
│ Stock Holdings                          [Prefill from previous]│  ← NEW button
│                                                                │
│ ┌─ Holding #1 ────────────────────────────────────────────┐   │
│ │ Account: [CommSec ▼]  (pre-selected if prefilled)       │   │
│ │ Ticker: CBA    Company: Commonwealth Bank               │   │
│ │ Qty: 100       Buy Price: $95.00                        │   │
│ │ Buy Date: 2024-01-15  Current Price: [0.00] ← blank     │   │
│ └────────────────────────────────────────────────────────┘   │
│ ...                                                            │
│ [+ Add Holding]                         [Cancel] [Create]      │
└────────────────────────────────────────────────────────────────┘
```

### HoldingFormModal with Pre-selected Account

```
┌─ Add Stock Holding ───────────────────────────────────────────┐
│ Add a new stock to your snapshot                               │
│                                                                │
│ Brokerage Account *                                            │
│ [CommSec ▼]  ← pre-selected from accordion context            │
│                                                                │
│ Ticker: [     ]   Company: [                  ]                │
│ ...                                                            │
└────────────────────────────────────────────────────────────────┘
```

---

## Success Criteria

### Prefill
- [ ] "Prefill from previous snapshot" button appears in `NewSnapshotModal` when a prior snapshot exists
- [ ] Clicking it replaces all holding rows with prior snapshot's holdings (all fields copied; `currentPrice=0`, sale fields cleared)
- [ ] Button is hidden when no prior snapshot exists
- [ ] Button shows loading state while query is fetching
- [ ] User can still add/remove holdings after prefill
- [ ] Submitting after prefill creates a valid new snapshot

### Account Pre-selection
- [ ] Clicking "Add Holding" within Account X's accordion opens `HoldingFormModal` with Account X pre-selected
- [ ] Pre-selection only applies in create mode (edit mode is unaffected)
- [ ] Modal still works when opened from a context without an account (e.g., future "Add Holding" button outside an accordion)
- [ ] Closing the modal clears the pre-selection state

---

## Implementation Phases

| Phase | Scope | Effort |
|-------|-------|--------|
| 1 | Account pre-selection in `HoldingFormModal` | Small — 3 file changes, ~15 lines |
| 2 | Prefill in `NewSnapshotModal` | Medium — query + mapping + UI toggle |

Phase 1 is the fastest win and fully independent of Phase 2.
