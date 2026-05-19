# Brokerage Hybrid Model — High-Level Design (HLD)

## Problem & Proposed Solution

**Problem**: After the `business-global-institutions` refactor, ALL brokerages are created as global (`userId=null`), meaning any end user can pollute the shared institution catalog. This violates industry standards and creates UX/security issues in multi-tenant deployments.

**Solution**: Implement a **hybrid model** matching industry best practices (Mint, YNAB, Monarch, Empower):
- **Admin-curated global brokerages** (`userId=null`) via `/settings/brokerages` page
- **User-private custom brokerages** (`userId=<id>`) created inline in stock modals
- Queries return **both global + user-owned** institutions, scoped correctly

---

## Architecture Decisions

1. **Global brokerages are admin-managed**  
   Rationale: Matches `/settings/banks` pattern; prevents user pollution of shared catalog; admin can pre-populate common brokerages (Fidelity, Schwab, etc.)

2. **User-created brokerages are private**  
   Rationale: Matches all major personal finance apps; no side effects; users can add regional/international brokers not in global catalog

3. **Queries use OR clause for global + user-owned**  
   Rationale: `WHERE (userId IS NULL OR userId = <session.user.id>)` returns both scopes; maintains backward compatibility with existing API contracts

4. **No schema migration required**  
   Rationale: `Business.userId` is already nullable from prior refactor; only code logic changes needed

5. **Clone bank infrastructure**  
   Rationale: `/settings/banks` already implements the admin management pattern; reuse service/controller/router/form structure

6. **Inline creation stays user-scoped**  
   Rationale: `business.create` mutation called from stock modals should always set `userId=session.user.id`; prevents accidental global pollution

7. **UI shows visual distinction**  
   Rationale: Users need to know which institutions are global vs custom; use section headers or emoji prefixes (🌍/👤)

8. **Deletion requires dependency check**  
   Rationale: Deleting a brokerage with existing FinancialAccounts would break referential integrity; check before delete or show error

9. **Admin role enforcement deferred to Phase 2**  
   Rationale: Phase 1 focuses on hybrid scoping logic; role-based access control added later

10. **Uniqueness constraint allows dual "Fidelity" entries**  
   Rationale: `@@unique([name, userId, type])` permits global "Fidelity" (`userId=null`) AND User A's "Fidelity" (`userId=A`); document this edge case in UI

---

## Component/Service Change Summary

### New Files (Clone from Banks)
- `src/app/(authorized)/settings/brokerages/page.tsx` — Admin page (parallel to banks)
- `src/app/(authorized)/settings/brokerages/form.tsx` — CRUD form for global brokerages
- `src/server/services/brokerage.service.ts` — Service layer: add/get/delete (always `userId=null`)
- `src/server/controllers/brokerage.controller.ts` — Controller handlers
- `src/server/trpc/router/brokerage.ts` — tRPC router: `saveBrokerageDetails`, `getAllBrokerages`, `removeBrokerageDetails`
- `src/server/schema/brokerage.schema.ts` — Zod schema (simplified: name only)

### Modified Files
- `src/server/trpc/router/_app.ts` — Mount `brokerageRouter`
- `src/server/trpc/router/business.ts` — `getBrokeragesWithAccounts` query: add `OR [{ userId: null }, { userId }]`
- `src/server/trpc/router/business.ts` — `create` mutation: keep as user-scoped (no change)
- `src/app/(authorized)/assets/stocks/NewSnapshotModal.tsx` — UI: group global vs user brokerages in dropdown
- `src/app/(authorized)/assets/stocks/HoldingFormModal.tsx` — Same UI update

---

## Data Model (No Schema Change)

**Existing schema already supports hybrid model**:

```prisma
model Business {
  id               String               @id @default(cuid())
  name             String
  type             BusinessEnumType?
  financialAccounts FinancialAccount[]
  userId           String?              // Nullable: null = global, <id> = user-owned
  user             User?                @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@unique([name, userId, type])
}
```

**Ownership semantics** (unchanged from prior refactor):
- `userId=null` → Global institution (admin-curated)
- `userId=<id>` → User-private institution

**Brokerage-specific rules**:
- Global: Created via `/settings/brokerages` (admin route)
- User-private: Created via `business.create` mutation in stock modals

---

## Query Logic Changes

### Before (Global Only)
```typescript
// business.ts - getBrokeragesWithAccounts
const brokerages = await prisma.business.findMany({
  where: {
    userId: null,        // ❌ Only global
    type: 'BROKERAGE',
  },
  include: {
    financialAccounts: {
      where: { userId: session.user.id },
    },
  },
});
```

### After (Hybrid)
```typescript
const brokerages = await prisma.business.findMany({
  where: {
    type: 'BROKERAGE',
    OR: [
      { userId: null },               // ✅ Global brokerages
      { userId: session.user.id },    // ✅ User's custom brokerages
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

## UI/UX Changes

### Admin Page (`/settings/brokerages`)
**Layout**: Identical to `/settings/banks`

| Element | Content |
|---------|---------|
| Title | "Brokerage Institutions" |
| Description | "Global institutions shared across all users. Pre-populate common brokerages for easier account setup." |
| Form | Inline text input + "Add" button (name only) |
| Table | List of global brokerages with delete buttons |
| Empty state | "No brokerage institutions yet. Add your first brokerage above to get started." |

### Stock Modal Dropdowns (Institution Picker)
**Before**:
```
[Dropdown]
  Select or create brokerage...
  ├─ Fidelity
  ├─ CommSec
  └─ (type to create...)
```

**After (Grouped)**:
```
[Dropdown]
  Select or create brokerage...
  
  🌍 Popular Brokerages
  ├─ Fidelity
  ├─ Charles Schwab
  └─ CommSec
  
  👤 My Custom Brokerages
  ├─ Interactive Brokers
  └─ Local Credit Union
  
  ──────────────────
  📝 Type to create new (private to you)
```

**Implementation**: Use `react-select` grouped options or render section headers manually in CreatableAppSelect.

---

## Success Criteria

- ✅ `/settings/brokerages` page renders and functions identically to `/settings/banks`
- ✅ Admin can create global brokerages (name only, `userId=null`)
- ✅ Users can create private brokerages inline (stock modals, `userId=<session.user.id>`)
- ✅ `getBrokeragesWithAccounts` returns global + user-owned (not other users')
- ✅ Dropdown UI shows visual distinction (grouped or prefixed)
- ✅ Uniqueness constraint prevents duplicates within scope (global vs per-user)
- ✅ Deletion fails gracefully if FinancialAccounts exist
- ✅ No regressions: existing bank holdings, philanthropy, stock features unaffected
- ✅ All unit tests pass (new tests for hybrid query logic)

---

## Out of Scope / Future Phases

| Area | Status |
|------|--------|
| **Admin role enforcement** | Phase 2 — Add `user.role` enum; protect `/settings/brokerages` route |
| **Address fields for brokerages** | Out of scope — Banks have address fields; brokerages simplified (name only) |
| **Merge duplicate institutions** | Future — If user creates "Fidelity" before admin adds global, both coexist |
| **Institution logo/icon** | Future — Visual enhancement; not critical for MVP |
| **Deletion cascade policy UI** | Future — Show "Cannot delete: 3 accounts depend on this institution" message |
| **PHILANTHROPY as hybrid** | Out of scope — Stays user-only; no global philanthropies |
| **Bulk import global brokerages** | Future — Seed script to pre-populate common US/AU brokerages |

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Users confused by duplicate "Fidelity" entries (global + custom) | Use clear labels: "🌍 Fidelity" vs "👤 Fidelity (My Custom)" |
| Admin deletes global brokerage with user accounts | Add dependency check; return error; show "3 accounts use this" |
| Migration from current global-only data | No migration needed; existing brokerages stay global; new inline creations are user-scoped |
| Performance regression on hybrid query | OR clause indexed on `(type, userId)`; marginal impact; verified via EXPLAIN |

---

## Dependencies

**None** — All infrastructure exists:
- Schema already supports nullable `userId`
- Bank implementation provides full reference pattern
- tRPC, Prisma, UI components already in place

---

## Rollout Plan

**Phase 1**: Implement hybrid model (this spec)
- Clone bank infrastructure for `/settings/brokerages`
- Update `getBrokeragesWithAccounts` query to hybrid (OR clause)
- UI grouping in stock modals
- Unit tests for hybrid query logic

**Phase 2**: Admin role enforcement
- Add `user.role` enum to User model
- Middleware to protect `/settings/*` routes
- Only admins can create global institutions

**Phase 3**: UX polish
- Institution logos
- Bulk import seed data
- Merge duplicate institutions UI
