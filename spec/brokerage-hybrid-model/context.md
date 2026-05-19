# Brokerage Hybrid Model: Context & File Inventory

## Feature Summary

Implement a **hybrid brokerage institution model** matching industry standards:
- **Global brokerages** (`userId=null`) are admin-curated via `/settings/brokerages` (parallel to `/settings/banks`)
- **User-private brokerages** (`userId=<id>`) are created inline by end users in stock modals
- Queries return **both global + user-owned** brokerages, preventing side effects where User A's custom brokerage appears in User B's list

**Current Problem**: The `business-global-institutions` refactor made ALL brokerages global (`userId=null`), meaning any user can pollute the global catalog. Industry research shows all major apps (Mint, YNAB, Monarch, Empower) use a hybrid model: global catalog + per-user custom entries.

**Schema**: Already supports nullable `userId` — no schema migration needed.

---

## Industry Research Summary

**Apps researched**: Mint, YNAB, Monarch Money, Empower, Copilot Money, PocketSmith, Quicken

**Findings**:
- ✅ All use **global catalog** for connected accounts (via Plaid/Yodlee)
- ✅ All allow **per-user custom/manual institutions** (private, not shared)
- ✅ Custom institutions are NEVER added to the global catalog
- ✅ UI typically two-level: Institution → Account

**Consensus**: Hybrid model (global + per-user) is the industry standard.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/app/(authorized)/settings/brokerages/page.tsx` | Admin page header (parallel to `/settings/banks/page.tsx`) |
| `src/app/(authorized)/settings/brokerages/layout.tsx` | Layout wrapper (optional; copy from banks) |
| `src/app/(authorized)/settings/brokerages/form.tsx` | Brokerage institution CRUD form (clone of `banks/form.tsx`) |
| `src/server/services/brokerage.service.ts` | Service layer: `addBrokerageDetails`, `getBrokerageDetails`, `deleteBrokerageDetails` (clone of `bank.service.ts`) |
| `src/server/controllers/brokerage.controller.ts` | Controller layer: handlers for add/list/delete (clone of `bank.controller.ts`) |
| `src/server/trpc/router/brokerage.ts` | tRPC router: `saveBrokerageDetails`, `getAllBrokerages`, `removeBrokerageDetails` |
| `src/server/schema/brokerage.schema.ts` | Zod schema: `createBrokerageSchema`, `params` (simplified from bank schema — name only) |

---

## Files to Modify

| File | Change |
|------|--------|
| `src/server/trpc/router/_app.ts` | Import and mount `brokerageRouter` |
| `src/server/controllers/business.controller.ts` | `addBusinessDetailsHandler`: Add context flag `isAdminRoute` to distinguish admin vs inline creation |
| `src/server/trpc/router/business.ts` | `getBrokeragesWithAccounts`: Update query to return global + user-owned; `create` mutation: keep as user-scoped |
| `src/app/(authorized)/assets/stocks/StockAssetsClient.tsx` | Update `getBrokeragesWithAccounts` query (no code change; API contract stays same) |
| `src/app/(authorized)/assets/stocks/NewSnapshotModal.tsx` | UI: Show "🌍 Popular Brokerages" and "👤 My Custom Brokerages" sections in dropdown |
| `src/app/(authorized)/assets/stocks/HoldingFormModal.tsx` | Same dropdown UI update as NewSnapshotModal |

---

## Current Schema (Relevant)

```prisma
model Business {
  id               String               @id @default(cuid())
  name             String
  addressLine      String?
  streetAddress    String?
  suburb           String?
  postcode         Int?
  state            String?
  type             BusinessEnumType?
  financialAccounts FinancialAccount[]
  // userId is null for global/admin-managed institutions (BANK, BROKERAGE).
  // userId is set for user-specific institutions (e.g. PHILANTHROPY).
  userId           String?
  user             User?                @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@unique([name, userId, type])
}

model FinancialAccount {
  id            String         @id @default(cuid())
  name          String
  institutionId String
  institution   Business       @relation(fields: [institutionId], references: [id])
  userId        String
  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  stockHoldings StockHolding[]

  @@unique([name, institutionId, userId])
}
```

**Key constraint**: `@@unique([name, userId, type])` on Business prevents duplicate names per user per type.
- Global brokerage "Fidelity" (`userId=null`): one record
- User A's custom "Interactive Brokers" (`userId=A`): one record per user
- User B's custom "Interactive Brokers" (`userId=B`): separate record

---

## Existing Patterns to Reuse

### Bank Service Pattern (`bank.service.ts`)

```typescript
export const addBankDetails = async (
  input: Omit<Prisma.BusinessUncheckedCreateInput, 'userId'>
) => {
  const result = await prisma.business.create({ data: { ...input, userId: null } });
  return result as Business;
};

export const getBankDetails = async (
  where?: Partial<Prisma.BusinessWhereUniqueInput>,
  select?: Prisma.BusinessSelect
) => {
  const finalWhere: Partial<Prisma.BusinessWhereUniqueInput> = {
    ...where,
    type: 'BANK',
  };
  return (await prisma.business.findMany({
    where: finalWhere,
    select,
  })) as Array<Business>;
};
```

**For brokerages**: Clone this but replace `'BANK'` with `'BROKERAGE'`.

### Bank Router Pattern (`bank.ts`)

```typescript
export const bankRouter = router({
  saveBankDetails: protectedProcedure
    .input(createBankSchema)
    .mutation(({ input, ctx: { session } }) =>
      addBankDetailsHandler({ input, userId: session.user.id })
    ),
  getAllBanks: protectedProcedure.query(() => {
    return allBankDetailsHandler();
  }),
  removeBankDetails: protectedProcedure
    .input(params)
    .mutation(({ input }) => removeBankDetailsHandler({ params: input })),
});
```

**For brokerages**: Clone and replace `bank` → `brokerage`.

### Bank Form Pattern (`banks/form.tsx`)

- Inline text input + "Add" button
- Table with delete buttons
- Optimistic mutation invalidation
- Empty state with icon

**For brokerages**: Clone and replace Bank → Brokerage (icon: `Building2` → `TrendingUp` or `LineChart`).

---

## Data Flow Diagrams

### Current (Broken): All User-Created Brokerages Are Global

```
User A creates "E*TRADE" inline
  ↓
Business.create({ name: "E*TRADE", type: "BROKERAGE", userId: null })
  ↓
Global brokerage created (visible to ALL users)
  ↓
❌ User B sees "E*TRADE" in their institution list
```

### Proposed (Hybrid): Global + Per-User

```
Admin creates "Fidelity" via /settings/brokerages
  ↓
Business.create({ name: "Fidelity", type: "BROKERAGE", userId: null })
  ↓
Global brokerage (visible to ALL users)

User A creates "E*TRADE" inline in stock modal
  ↓
Business.create({ name: "E*TRADE", type: "BROKERAGE", userId: "user-A-id" })
  ↓
User-private brokerage (visible ONLY to User A)

getBrokeragesWithAccounts query for User A
  ↓
WHERE type="BROKERAGE" AND (userId IS NULL OR userId="user-A-id")
  ↓
Returns: [Fidelity (global), E*TRADE (User A's custom)]
```

---

## Query Pattern (Key Change)

### Old Query (Global Only)
```typescript
// business.ts router - getBrokeragesWithAccounts
const brokerages = await prisma.business.findMany({
  where: {
    userId: null,
    type: 'BROKERAGE',
  },
  include: {
    financialAccounts: {
      where: { userId: session.user.id },
    },
  },
});
```

### New Query (Hybrid)
```typescript
const brokerages = await prisma.business.findMany({
  where: {
    type: 'BROKERAGE',
    OR: [
      { userId: null },               // Global brokerages (admin-curated)
      { userId: session.user.id },    // User's custom brokerages
    ],
  },
  include: {
    financialAccounts: {
      where: { userId: session.user.id },
    },
  },
});
```

---

## Known Constraints & Gotchas

### 1. Uniqueness Constraint Namespacing
`@@unique([name, userId, type])` means:
- "Fidelity" as global BROKERAGE (`userId=null`): **one** record total
- "Fidelity" as User A's BROKERAGE (`userId=A`): User A can create their own
- Admin can't create duplicate global "Fidelity" (unique constraint violation)

**Edge case**: User creates "Fidelity" before admin does → User's private "Fidelity" exists; admin creates global "Fidelity" → Both coexist; user sees both in dropdown.

**Solution**: Document this behavior in UI (e.g., label user's as "My Fidelity" or similar).

### 2. Admin Role Check (Out of Scope for Phase 1)
Currently **any authenticated user** can access `/settings/brokerages`. Phase 1 accepts this; Phase 2 adds role check.

**Future**: Add `user.role` enum (ADMIN, USER) and protect route with middleware.

### 3. Dropdown Grouping UX
CreatableAppSelect doesn't natively support option groups. Use **section headers** or **prefixes**:
- `"🌍 Fidelity"` (global)
- `"👤 My Local Broker"` (user's)

**Alternative**: Use `react-select` with `options: [{ label: 'Popular', options: [...] }, { label: 'My Custom', options: [...] }]`.

### 4. No Cascade Delete from Business → FinancialAccount
`onDelete: Cascade` is on `FinancialAccount.userId` (user deletion), not on `institutionId`. Deleting a Business/BROKERAGE will **fail** if any FinancialAccounts reference it.

**Mitigation**: Check for dependent accounts before deletion; show error if exists.

---

## Migration Notes

**No schema migration needed** — `Business.userId` is already nullable from prior `business-global-institutions` refactor.

**Data cleanup (if needed)**:
```sql
-- Find brokerages created by users (should be user-scoped, not global)
SELECT id, name, userId FROM "Business" WHERE type='BROKERAGE' AND userId IS NULL;

-- If any exist that should be user-scoped, manually update:
UPDATE "Business" SET userId='<user-id>' WHERE id='<brokerage-id>';
```

---

## Success Criteria

- ✅ Admin can create global brokerages via `/settings/brokerages`
- ✅ Users can create private brokerages inline in stock modals
- ✅ `getBrokeragesWithAccounts` returns global + user-owned
- ✅ User A's custom brokerages do NOT appear in User B's list
- ✅ UI shows visual distinction between global and user-owned
- ✅ Uniqueness constraint prevents duplicate names per scope
- ✅ Deletion of global brokerage is blocked if accounts exist
- ✅ All tests pass (unit + integration)
