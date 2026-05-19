# Add Entry to Existing Snapshot — High Level Design

**Version:** 1.0
**Status:** Specced
**Feature:** Allow users to append a new `BankBalanceRecord` to any existing `BankBalanceSnapshot`

---

## Problem Statement

After a `BankBalanceSnapshot` is saved, users have no way to add a bank account they forgot to include. The only workaround today is creating a full duplicate snapshot with all accounts re-entered, which pollutes the snapshot history and silently changes historical totals. For a user who has 12+ accounts across 3 banks, this workaround is expensive and error-prone.

The fix is a single per-bank "Add Account" inline form accessible from the expanded Disclosure panel, calling one new tRPC mutation.

---

## Architecture Overview

```
User clicks "+ Add Account" on a bank accordion
        │
        ▼
BankAssetsClient.tsx (Client Component)
  setAddingEntryForBankId(bank.bankId)
        │
        ▼  (inline form renders inside Disclosure.Panel)
  User selects / creates account  →  AppCreatableSelect
    └── if new account: trpc.bankAsset.createBankAccount.mutateAsync()
  User enters balance  →  NumericFormat
  User clicks "Add"
        │
        ▼
  trpc.bankAsset.addEntryToSnapshot.useMutation()
  input: { snapshotId, accountId, balance }
        │
        ▼
addEntryToSnapshotHandler (controller)
        │
        ▼
addEntryToSnapshot (service)
  1. Verify BankBalanceSnapshot.userId === caller userId
  2. Verify BankAccount.userId === caller userId
  3. Attempt prisma.bankBalanceRecord.create(...)
     → DB enforces @@unique([accountId, snapshotId])
        │
        ▼
BankBalanceRecord created in DB
        │
        ▼
onSuccess: invalidate getSnapshots + getMostRecentSnapshot + getSnapshotTotals
           → React re-renders accordion with new entry
```

---

## Architecture Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | **No schema migration** | Reuse existing `BankBalanceRecord` model and `@@unique([accountId, snapshotId])` constraint | The DB already enforces the duplicate guard. No new columns or tables needed. |
| 2 | **No restriction on historical snapshots** | Allow adding entries to any snapshot, past or present | The user understands consequences. Blocking historical edits adds friction with no safety benefit — totals change only for that snapshot and cascade nowhere. |
| 3 | **Per-bank inline form, not a modal** | Render an inline form below the last account in each Disclosure.Panel | Contextually scoped: account list is already filtered to that bank. Matches the existing inline account-name editing pattern already in `BankAssetsClient.tsx`. |
| 4 | **One form open at a time** | `addingEntryForBankId: string \| null` — only one bank's form visible | Prevents conflicting state; mirrors `editingEntry` and `editingAccountName` state design. |
| 5 | **AppCreatableSelect for account** | Reuse `AppCreatableSelect` exactly as in `NewSnapshotModal.tsx` | Consistent UX; supports both selecting an existing account and typing to create a new one inline. |
| 6 | **Exclude already-in-snapshot accounts from dropdown** | Filter `options` on the client by comparing with `snapshot.balanceRecords` | Prevents the user from picking an account that would fail the `@@unique` constraint. Server still enforces the constraint as a safety net. |
| 7 | **Service-layer ownership verification** | Check both `BankBalanceSnapshot.userId` and `BankAccount.userId` server-side | Defence in depth; mirrors the guard in `updateBankAssetEntry` and `deleteBankAssetEntry`. |
| 8 | **No audit trail** | Not recording who added an entry or when beyond the default `createdAt` | Explicitly out of scope per feature brief; `BankBalanceRecord.createdAt` already captures timestamp. |

---

## Data Model Changes

**None.** No changes to `prisma/schema.prisma` are required. The `BankBalanceRecord` model already has:
- `@@unique([accountId, snapshotId])` — duplicate guard
- `onDelete: Cascade` from snapshot — consistent lifecycle
- `balance Decimal @db.Money` — correct precision

---

## Data Flow Detail

### Happy path — existing account selected

```
1. User opens accordion for "ANZ" bank
2. Clicks "+ Add Account" → addingEntryForBankId = "anz-bank-id"
3. Account dropdown shows ANZ accounts NOT already in this snapshot
4. User selects "ANZ Savings" (accountId = "acc-123")
5. User types balance: $5000.00
6. User clicks "Add"
7. addEntryToSnapshot.mutate({ snapshotId: "snap-abc", accountId: "acc-123", balance: 5000 })
8. Server: snapshot found, account found, no existing record → create BankBalanceRecord
9. onSuccess: invalidate queries → getSnapshotTotals re-fetches → totals update
10. addingEntryForBankId reset to null → form closes
```

### Happy path — new account created via CreatableSelect

```
1–2. Same as above
3. User types "ANZ Term Deposit" in select → onCreateOption fires
4. createBankAccount.mutateAsync({ name: "ANZ Term Deposit", bankId: "anz-bank-id" })
5. Returns newAccountId = "acc-456"
6. setNewEntryAccountId("acc-456")
7. User enters balance, clicks "Add" → same as step 7+ above
```

### Error path — account already in snapshot (race condition)

```
1. User adds account via UI; DB unique constraint violation
2. Prisma throws P2002 (unique constraint failed)
3. handleCaughtError propagates as TRPCError
4. onError: inline error message "This account is already in the snapshot"
```

---

## UI — "Add Account" Inline Form Placement

```
┌─────────────────────────────────────────────────────┐
│  ANZ                                    $45,000.00  │  ← Disclosure.Button
├─────────────────────────────────────────────────────┤
│  Account Name          Balance    Actions            │  ← thead
│  ANZ Everyday          $20,000    ✏ 🗑               │
│  ANZ Savings           $25,000    ✏ 🗑               │
│ ─────────────────────────────────────────────────── │
│  [Account Select ▼] [$__.__] [Add] [Cancel]         │  ← NEW inline form
│ ─────────────────────────────────────────────────── │
│                          [+ Add Account]             │  ← NEW button (shown when form is closed)
└─────────────────────────────────────────────────────┘
```

The `+ Add Account` button appears below the accounts table. When clicked it is replaced by the inline form. "Cancel" restores the button.

---

## Component and Service Changes

### Phase 1 — Backend

| Layer | File | Change |
|-------|------|--------|
| Schema | `bank-asset.schema.ts` | `addEntryToSnapshotSchema` + `AddEntryToSnapshotInput` type |
| Service | `bank-asset.service.ts` | `addEntryToSnapshot(snapshotId, accountId, balance, userId)` |
| Controller | `bank-asset.controller.ts` | `addEntryToSnapshotHandler` |
| Router | `bank-asset.ts` | `addEntryToSnapshot` protectedProcedure mutation |

### Phase 2 — Frontend

| Layer | File | Change |
|-------|------|--------|
| Client | `BankAssetsClient.tsx` | State + inline form rendering inside `Disclosure.Panel` + mutation hook |

---

## Success Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| 1 | "+ Add Account" button appears inside each expanded bank accordion | Visual / e2e |
| 2 | Account dropdown is filtered to the accordion's bank, excluding accounts already in the snapshot | Visual: only unrecorded accounts appear |
| 3 | Selecting an existing account + balance + clicking Add → new row appears in table with correct balance | Visual + unit test on service |
| 4 | Bank total and grand total update immediately after add (no page reload) | Visual: query invalidation |
| 5 | Creating a new account via CreatableSelect then adding it to snapshot → both `BankAccount` and `BankBalanceRecord` created | Unit test on service + visual |
| 6 | Adding an account that is already in the snapshot → inline error shown, no duplicate record | Unit test (P2002 guard) + visual |
| 7 | Feature works for historical snapshots (not just most-recent) | Manual test: select older snapshot, add entry |
| 8 | `pnpm run build` passes | CI |
| 9 | Existing tests pass unchanged | CI |

---

## Out of Scope

| Item | Reason |
|------|--------|
| Audit trail (who added, when beyond `createdAt`) | Explicitly excluded — no access control complexity in MVP |
| Bulk add (multiple accounts in one operation) | Not needed; sequential per-account add covers the use case |
| Adding accounts across multiple banks in a single form | UX would be identical to creating a new snapshot; out of scope |
| Restricting edits to most-recent snapshot only | Intentionally allowed for flexibility — no cascade risk exists |
| Editing the snapshot date when adding an entry | Out of scope; the snapshot date is immutable once created |
| Deleting a `BankAccount` that has associated `BankBalanceRecord` rows | Separate feature; FK constraint already prevents accidental deletion |
