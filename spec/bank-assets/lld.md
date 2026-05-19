# Bank Assets Cash Tracking - Low-Level Design

## Phase Breakdown & Implementation Specs

### Phase 1: Database & API (✅ COMPLETE)

#### 1.1 Database Schema

**BankAccount Model**
```typescript
model BankAccount {
  id           String               @id @default(cuid())
  name         String
  bankId       String
  bank         Business             @relation(fields: [bankId], references: [id])
  userId       String
  user         User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  balanceRecords BankBalanceRecord[]
  transactions Transaction[]
  debitTransferRules  TransferMatchRule[] @relation("debitRules")
  creditTransferRules TransferMatchRule[] @relation("creditRules")
  createdAt    DateTime             @default(now())
  updatedAt    DateTime             @updatedAt

  @@unique([name, bankId, userId])
  @@index([userId, bankId])
}
```

**BankBalanceSnapshot Model**
```typescript
model BankBalanceSnapshot {
  id             String               @id @default(cuid())
  snapshotDate   DateTime
  userId         String
  user           User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  balanceRecords BankBalanceRecord[]
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt

  @@index([userId, snapshotDate])
}
```

**BankBalanceRecord Model**
```typescript
model BankBalanceRecord {
  id           String              @id @default(cuid())
  balance      Decimal             @db.Money
  accountId    String
  account      BankAccount         @relation(fields: [accountId], references: [id])
  snapshotId   String
  snapshot     BankBalanceSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  importImage  ImportImage?        @relation(fields: [importImageId], references: [id])
  importImageId String?
  createdAt    DateTime            @default(now())
  updatedAt    DateTime            @updatedAt

  @@unique([accountId, snapshotId])
  @@index([snapshotId])
}
```

#### 1.2 tRPC Router & Procedures

**Location**: `src/server/trpc/router/bank-asset.ts`

**Bank Account Procedures**
```typescript
bankAssetRouter.createBankAccount(input: CreateBankAccountInput)
  → Call: createBankAccountHandler(input, userId)
  → Returns: { account: BankAccountWithBank }
  → Validation: bankId references valid Business with type BANK

bankAssetRouter.getBankAccounts(input?: GetBankAccountsInput)
  → Call: getBankAccountsHandler(input, userId)
  → Returns: BankAccountWithBank[]
  → Scoped to userId, optionally filtered by bankId
```

**Snapshot Procedures**
```typescript
bankAssetRouter.createSnapshot(input: CreateBankAssetSnapshotInput)
  → Call: createSnapshotHandler(input, userId)
  → Returns: { snapshot: BankAssetSnapshotWithEntries }
  → Validation: All accountIds belong to userId
  → Transaction: Create snapshot + entries atomically

bankAssetRouter.getSnapshots(input: GetSnapshotsInput)
  → Call: getSnapshotsHandler(input, userId)
  → Returns: BankAssetSnapshotWithEntries[]
  → Filters: Optional date range (fromDate, toDate) for calendar year filtering
  → Order: snapshotDate DESC (most recent first)
  → Scoped to userId

bankAssetRouter.getMostRecentSnapshot(input: GetSnapshotsInput)
  → Call: getMostRecentSnapshotHandler(input, userId)
  → Returns: BankAssetSnapshotWithEntries | null
  → Filters: Optional date range
  → Returns: snapshots[0] from getSnapshots query

bankAssetRouter.getSnapshotById(input: GetSnapshotByIdInput)
  → Call: getSnapshotByIdHandler(input, userId)
  → Returns: BankAssetSnapshotWithEntries | null
  → Scoped to userId

bankAssetRouter.getSnapshotTotals(input: GetSnapshotByIdInput)
  → Call: getSnapshotTotalsHandler(input, userId)
  → Returns: { grandTotal, banks: [{ bankId, bankName, total, accounts }] }
  → Computed aggregation from snapshot entries
```

**Entry Procedures**
```typescript
bankAssetRouter.updateEntry(input: UpdateBankAssetEntryInput)
  → Call: updateEntryHandler(input, userId)
  → Returns: { entry: BankAssetEntryWithAccount }
  → Validates: Entry belongs to user's snapshot
  → Updates: BankBalanceRecord.balance

bankAssetRouter.deleteEntry(input: DeleteEntryInput)
  → Call: deleteEntryHandler(input, userId)
  → Returns: { success: true }
  → Validates: Entry belongs to user
  → Deletes: BankBalanceRecord (soft delete via cascade if needed)

bankAssetRouter.deleteSnapshot(input: DeleteSnapshotInput)
  → Call: deleteSnapshotHandler(input, userId)
  → Returns: { success: true }
  → Validates: Snapshot belongs to user
  → Deletes: BankBalanceSnapshot (cascade deletes entries via Prisma)
```

#### 1.3 Input Schemas (Zod)

**Location**: `src/server/schema/bank-asset.schema.ts`

```typescript
createBankAccountSchema = z.object({
  name: z.string().min(1).max(100),
  bankId: z.string().cuid(),
});

getBankAccountsSchema = z.object({
  bankId: z.string().cuid().optional(),
}).optional();

createBankAssetSnapshotSchema = z.object({
  snapshotDate: z.date(),
  entries: z.array(z.object({
    accountId: z.string().cuid(),
    balance: z.number().min(0),
  })).min(1),
});

updateBankAssetEntrySchema = z.object({
  entryId: z.string().cuid(),
  balance: z.number().min(0),
});

deleteEntrySchema = z.object({
  entryId: z.string().cuid(),
});

deleteSnapshotSchema = z.object({
  snapshotId: z.string().cuid(),
});

getSnapshotsSchema = z.object({
  calendarYearId: z.string().optional(),
  fromDate: z.date().optional(),
  toDate: z.date().optional(),
}).optional();

getSnapshotByIdSchema = z.object({
  snapshotId: z.string().cuid(),
});

updateBankAccountSchema = z.object({
  accountId: z.string().cuid(),
  name: z.string().min(1).max(100),
});
```

#### 1.4 Validation Rules

- **Account uniqueness**: Within same bank + user, no duplicate names
- **Date range**: fromDate ≤ toDate for snapshots filter
- **Balance range**: 0 ≤ balance ≤ 999999999.99 (9 digits + 2 decimals)
- **User scope**: All queries verify ownership before returning data
- **Transaction safety**: Snapshot creation wraps in Prisma transaction

---

### Phase 2: Basic UI - Display (✅ COMPLETE)

#### 2.1 Route & Page Component

**Location**: `src/app/(authorized)/assets/bank/page.tsx`

```typescript
export default async function BankAssetsPage({ searchParams }) {
  // Get user session
  const session = await auth();
  
  // Fetch calendar years (FISCAL, ANNUAL only)
  const calendarYears = await getCalendarYearsHandler(['FISCAL', 'ANNUAL']);
  
  // Resolve calendar type from URL or user preference
  const calendarTypeParam = getSelectedParam(params?.type) || fiscalYearType || 'FISCAL';
  const calendarYearIdParam = getSelectedParam(params?.yearId);
  
  // Filter & select calendar year
  const filteredYears = calendarYears.filter(cy => cy.type === calendarTypeParam);
  let selectedCalendarYear = filteredYears.find(cy => cy.id === calendarYearIdParam);
  if (!selectedCalendarYear && filteredYears.length > 0) {
    selectedCalendarYear = filteredYears[0]; // Default to most recent
  }
  
  // Pass to client component
  return (
    <main className="px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl font-bold">Bank Assets — Cash Tracking</h1>
      <p className="text-muted-foreground">Manage and track your bank account snapshots</p>
      <Suspense fallback={<p>Loading...</p>}>
        <BankAssetsClient initialData={initialData} />
      </Suspense>
    </main>
  );
}
```

**Metadata**:
- title: "Bank Assets | My Financials"
- description: "Track cash holdings across multiple bank accounts"

#### 2.2 Client Component Structure

**Location**: `src/app/(authorized)/assets/bank/BankAssetsClient.tsx`

**State Management**:
```typescript
// Calendar selection
const [selectedCalendarType, setSelectedCalendarType] = useState<CalendarType>('FISCAL');
const [selectedCalendarYearId, setSelectedCalendarYearId] = useState('');

// Snapshot selection
const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);

// Modal state
const [showNewSnapshotModal, setShowNewSnapshotModal] = useState(false);

// Derived state
const selectedCalendarYear = calendarYears.find(cy => cy.id === selectedCalendarYearId);
const filters = {
  fromDate: selectedCalendarYear?.fromDate,
  toDate: selectedCalendarYear?.toDate,
};
```

**tRPC Queries**:
```typescript
// Fetch snapshots for selected calendar year
const { data: snapshots, isLoading: isLoadingSnapshots } = 
  trpc.bankAsset.getSnapshots.useQuery(filters);

// Compute totals for selected snapshot
const { data: totals } = = trpc.bankAsset.getSnapshotTotals.useQuery(
  { snapshotId: selectedSnapshotId || '' },
  { enabled: !!selectedSnapshotId }
);
```

**UI Sections**:
1. **Header**: Title, description
2. **Controls**:
   - Calendar type tabs: FISCAL | ANNUAL buttons
   - Calendar year dropdown
   - Snapshot date display: "Snapshot as of: DD MMM YYYY"
3. **Grand Total Card**: "Total Cash Position: $XX,XXX.XX"
4. **Bank Accordion**: One section per bank in snapshot
5. **New Snapshot Button**: Float top-right or sticky bottom

#### 2.3 Calendar Selectors

**Calendar Type Tabs**
- Buttons: FISCAL, ANNUAL (ZAKAT hidden for now)
- Active state: Button styling from Flowbite
- Handler: Update URL with `?type=FISCAL`, fetch new snapshots

**Calendar Year Dropdown**
- Options: Populated from `initialData.calendarYears`
- Default: `selectedCalendarYear` from server
- Handler: Update URL with `?yearId=xyz`, fetch new snapshots
- Format: "2025-2026" or "2025" depending on type

#### 2.4 Snapshot Display

**Snapshot Date**: 
- Text: "Snapshot as of: 01 Feb 2026"
- Empty state: "No snapshot recorded"

**Grand Total Card**:
- Format: "Total Cash Position: $XX,XXX.XX"
- Shows $0.00 if no snapshot
- Updated when snapshot selection changes

#### 2.5 Empty States

**No banks configured**:
```
"You have no banks configured."
[Link to Settings → Banks]
```

**No snapshots for calendar year**:
```
"No snapshots recorded for {CalendarType} {Year}."
[New Snapshot button]
```

---

### Phase 3: Snapshot Creation (✅ COMPLETE)

#### 3.1 New Snapshot Modal Component

**Location**: `src/app/(authorized)/assets/bank/NewSnapshotModal.tsx`

**Props**:
```typescript
interface NewSnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  mostRecentSnapshot: BankAssetSnapshotWithEntries | null;
  onSuccess: () => void;
  userId: string;
}
```

**State**:
```typescript
const [formData, setFormData] = useState<SnapshotFormData>({
  snapshotDate: new Date(), // Today
  entries: [], // Pre-filled from mostRecentSnapshot
});
```

**Pre-fill Logic**:
```typescript
useEffect(() => {
  if (mostRecentSnapshot && isOpen) {
    const prefilledEntries = mostRecentSnapshot.balanceRecords.map(record => ({
      accountId: record.account.id,
      accountName: record.account.name,
      bankId: record.account.bank.id,
      bankName: record.account.bank.name,
      balance: record.balance,
    }));
    
    setFormData({
      snapshotDate: new Date(), // NOT previous snapshot date
      entries: prefilledEntries,
    });
  }
}, [mostRecentSnapshot, isOpen]);
```

#### 3.2 Form Fields

**Snapshot Date** (Required)
- Component: `<input type="date" />`
- Default: today
- Validation: date is valid and not in future (optional)

**Entry Rows** (Array of entries)
Each row contains:

1. **Bank Selector** (Required)
   - Component: `<select>` or dropdown
   - Options: User's configured banks (from Business type BANK)
   - Handler: onChange updates entryItem.bankId

2. **Account Selector** (Required, CreatableSelect)
   - Component: `react-select/creatable`
   - Options: Accounts for selected bank (from BankAccount)
   - Creatable: Allows typing new account name
   - New account creation:
     ```typescript
     onCreateOption: async (inputValue) => {
       const newAccount = await trpc.bankAsset.createBankAccount.mutate({
         name: inputValue,
         bankId: entryItem.bankId,
       });
       return { value: newAccount.id, label: newAccount.name };
     }
     ```
   - Handler: onChange updates entryItem.accountId/accountName

3. **Balance** (Required)
   - Component: `<input type="number" />`
   - Format: Currency input, 2 decimal places
   - Validation: >= 0
   - Handler: onChange updates entryItem.balance

**Add Account Row Button**
- Text: "+ Add Account"
- Handler: Append new entry to formData.entries
- Default new entry: { accountId: '', balance: 0, bankId: '' }

#### 3.3 Form Submission

**Save Handler**:
```typescript
async function handleSave() {
  // Validation
  if (!formData.snapshotDate) return error('Snapshot date required');
  if (formData.entries.length === 0) return error('At least one account required');
  if (formData.entries.some(e => !e.accountId || e.balance < 0)) return error('Invalid entry');

  // tRPC mutation
  const result = await trpc.bankAsset.createSnapshot.mutate({
    snapshotDate: formData.snapshotDate,
    entries: formData.entries.map(e => ({
      accountId: e.accountId,
      balance: e.balance,
    })),
  });

  // Success handling
  if (result) {
    showToast('Snapshot created successfully');
    // Invalidate queries
    await trpc.useUtils().bankAsset.getSnapshots.invalidate();
    setSelectedSnapshotId(null); // Trigger auto-selection of new snapshot
    onClose();
  }
}
```

**Error Handling**:
- Inline validation errors per field
- Toast notification for server errors
- Modal stays open on error, allows user to fix and retry

---

### Phase 4: Edit & Delete (✅ COMPLETE)

#### 4.1 Edit Account Balance

**Trigger**: Edit icon on AccountRow component

**Flow**:
1. Click edit icon → Open edit modal with current balance
2. User modifies balance
3. Click "Save" → tRPC mutation
4. Success: Invalidate snapshot query, update totals

**tRPC Mutation**:
```typescript
const updateMutation = trpc.bankAsset.updateEntry.useMutation({
  onSuccess: () => {
    trpc.useUtils().bankAsset.getSnapshots.invalidate();
  },
});

await updateMutation.mutateAsync({
  entryId: entry.id,
  balance: newBalance,
});
```

#### 4.2 Delete Account Entry

**Trigger**: Delete icon on AccountRow

**Confirmation Dialog**:
```
"Are you sure you want to delete [Account Name] from this snapshot?"
[Cancel] [Delete]
```

**tRPC Mutation**:
```typescript
const deleteMutation = trpc.bankAsset.deleteEntry.useMutation({
  onSuccess: () => {
    trpc.useUtils().bankAsset.getSnapshots.invalidate();
  },
});

await deleteMutation.mutateAsync({
  entryId: entry.id,
});
```

#### 4.3 Delete Entire Snapshot

**Trigger**: Menu or delete icon in snapshot header

**Confirmation Dialog**:
```
"This will permanently delete the snapshot from [Date] with [X] banks and [Y] accounts. This cannot be undone."
[Cancel] [Delete]
```

**tRPC Mutation**:
```typescript
const deleteSnapshotMutation = trpc.bankAsset.deleteSnapshot.useMutation({
  onSuccess: () => {
    trpc.useUtils().bankAsset.getSnapshots.invalidate();
    setSelectedSnapshotId(null); // Auto-select previous or show empty
  },
});

await deleteSnapshotMutation.mutateAsync({
  snapshotId: snapshot.id,
});
```

---

### Phase 5: Polish & Testing (✅ COMPLETE)

#### 5.1 Query Invalidation & Cache Management

**After Create Snapshot**:
```typescript
await trpc.useUtils().bankAsset.getSnapshots.invalidate();
// This refetches snapshots list, reflecting new snapshot
```

**After Update Entry**:
```typescript
await trpc.useUtils().bankAsset.getSnapshotById.invalidate({ snapshotId });
await trpc.useUtils().bankAsset.getSnapshotTotals.invalidate({ snapshotId });
// This refetches specific snapshot + totals
```

**After Delete Entry/Snapshot**:
```typescript
await trpc.useUtils().bankAsset.getSnapshots.invalidate();
// This refetches entire list
```

#### 5.2 Loading States

**Page Load**:
- Suspense fallback: "Loading..."
- After hydration: tRPC queries load snapshots

**Snapshot Query Loading**:
- Show: "Loading bank assets..."
- Hide when: `isLoadingSnapshots === false`

**Mutation Loading**:
- Button disabled during mutation
- Loading spinner in modal save button
- Toast message on error

#### 5.3 Error Handling

**tRPC Errors**:
- Catch in mutation handlers
- Display user-friendly toast messages
- Log errors to console for debugging
- Form remains open for user to correct

**Validation Errors**:
- Zod schema validates input
- Server returns validation error details
- Display inline next to relevant field

**Authorization Errors**:
- Server verifies userId ownership
- If mismatch: Return 401 Unauthorized
- Client redirects to login on 401

#### 5.4 UI State Management

**Accordion State**:
- Track expanded/collapsed banks in state
- Persist expansion preference (optional, localStorage)
- Default: Most recent snapshot banks expanded

**Modal State**:
- isOpen: boolean
- formData: Current form state during editing
- isSubmitting: boolean during mutation

**Loading Indicators**:
- Skeleton loaders for accordion while loading
- Disabled buttons during mutations
- Loading spinner in modal

---

### Phase 6: Account Management (⏳ PARTIAL - 50%)

#### 6.1 Account Rename Feature

**Status**: Service layer ready, NOT wired to UI/tRPC

**Completed Components**:
- ✅ `updateBankAccount()` service with validation
- ✅ `updateAccountName()` server action
- ✅ Input schema: `updateBankAccountSchema`
- ✅ Error handling for duplicate names

**Missing Components**:
- 🔲 tRPC procedure: `bankAssetRouter.updateAccount()`
- 🔲 UI component: Edit icon + inline editor in AccountRow
- 🔲 Form state: Input field for new name
- 🔲 Query invalidation: Cache refresh after rename
- 🔲 Error messaging: Display duplicate name error to user

#### 6.2 Server Action (Completed)

**Location**: `src/app/(authorized)/assets/bank/actions.ts`

```typescript
export async function updateAccountName(input: UpdateBankAccountInput) {
  const session = await auth();
  
  const validatedInput = updateBankAccountSchema.parse(input);
  
  const updatedAccount = await updateBankAccountService({
    accountId: validatedInput.accountId,
    name: validatedInput.name,
    userId: session.user.id,
  });
  
  revalidatePath('/assets/bank');
  
  return {
    success: true,
    data: { accountId: updatedAccount.id, name: updatedAccount.name },
  };
}
```

#### 6.3 Implementation Roadmap for Phase 6 Completion

**Step 1: Create tRPC Procedure**
```typescript
// In src/server/trpc/router/bank-asset.ts
updateAccount: protectedProcedure
  .input(updateBankAccountSchema)
  .mutation(({ input, ctx: { session } }) =>
    updateAccountHandler({ input, userId: session.user.id })
  ),
```

**Step 2: Create AccountRow Edit Mode**
```typescript
// In BankAssetsClient.tsx or new component
const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
const [newAccountName, setNewAccountName] = useState('');

function renderAccountRow(entry, bank) {
  if (editingAccountId === entry.id) {
    return (
      <div>
        <input 
          value={newAccountName}
          onChange={(e) => setNewAccountName(e.target.value)}
          onBlur={handleSaveAccountName}
        />
      </div>
    );
  }
  return (
    <div>
      {entry.account.name}
      <button onClick={() => startEdit(entry)}>✏️</button>
    </div>
  );
}
```

**Step 3: Wire to tRPC & Query Invalidation**
```typescript
const updateAccountMutation = trpc.bankAsset.updateAccount.useMutation({
  onSuccess: () => {
    trpc.useUtils().bankAsset.getSnapshots.invalidate();
  },
  onError: (error) => {
    showToast(`Error: ${error.message}`, 'error');
  },
});

async function handleSaveAccountName() {
  await updateAccountMutation.mutateAsync({
    accountId: editingAccountId,
    name: newAccountName,
  });
  setEditingAccountId(null);
}
```

**Step 4: Testing**
- Unit test: updateBankAccount service validation
- Integration test: E2E account rename flow
- Error case: Duplicate name within bank

---

## Component Structure

### Directory Layout

```
src/app/(authorized)/assets/bank/
├── page.tsx                 # Server component, page wrapper
├── BankAssetsClient.tsx     # Client orchestrator, query management
├── NewSnapshotModal.tsx     # Modal for snapshot creation
├── actions.ts               # Server actions (updateAccountName)
└── _components/
    ├── BankAccordion.tsx    # Accordion container
    ├── AccountRow.tsx       # Individual account display + actions
    ├── SummaryCard.tsx      # Totals display
    └── [other components]
```

### Data Flow Diagram

```
BankAssetsClient (orchestrator)
├── Calendar selectors (type, year)
├── Grand total card (computed from totals)
├── Bank accordion (mapped from snapshot)
│   └── BankAccordion (container)
│       └── AccountRow[] (individual accounts)
│           ├── Edit balance button → modal
│           ├── Delete entry button → confirm dialog
│           └── Edit name (future: Phase 6)
└── NewSnapshotModal (modal)
    ├── Date picker
    ├── Entry rows (bank/account/balance)
    ├── Create account button (CreatableSelect)
    └── Save/Cancel
```

---

## API Reference

### All endpoints require authentication (`protectedProcedure`)

### Snapshot Queries
- `bankAsset.getSnapshots(filters?)` - GET snapshots
- `bankAsset.getMostRecentSnapshot(filters?)` - GET most recent
- `bankAsset.getSnapshotById(snapshotId)` - GET by ID
- `bankAsset.getSnapshotTotals(snapshotId)` - GET computed totals

### Snapshot Mutations
- `bankAsset.createSnapshot(snapshotDate, entries[])` - POST create
- `bankAsset.deleteSnapshot(snapshotId)` - DELETE snapshot

### Entry Mutations
- `bankAsset.updateEntry(entryId, balance)` - PATCH update balance
- `bankAsset.deleteEntry(entryId)` - DELETE entry

### Account Queries
- `bankAsset.getBankAccounts(bankId?)` - GET list of accounts

### Account Mutations
- `bankAsset.createBankAccount(name, bankId)` - POST create account
- `bankAsset.updateAccount(accountId, name)` - PATCH rename (Phase 6 only)

---

## Testing & Validation

### Unit Tests Locations
- `src/server/services/__tests__/bank-asset.service.spec.ts`
- `src/server/controllers/__tests__/bank-asset.controller.spec.ts`

### Integration Tests Locations
- `e2e/bank-assets.spec.ts` (Playwright)

### Manual QA Checklist
- [ ] Create snapshot with multiple accounts
- [ ] Pre-fill works from most recent
- [ ] Edit balance updates total
- [ ] Delete entry removes from accordion
- [ ] Delete snapshot removes from list
- [ ] Calendar year filters snapshots correctly
- [ ] Error toast displays on mutation failure
- [ ] Query invalidation refetches correctly
