# Business Global Institutions — High-Level Design (HLD)

## Problem & Proposed Solution
The Business model previously forced all institutions (BANK, BROKERAGE, PHILANTHROPY) to be user-owned, which was incorrect for real-world financial institutions. The solution is to make `Business.userId` nullable: global institutions (BANK, BROKERAGE) have `userId = null`, while user-specific records (PHILANTHROPY, untyped) retain a userId. This aligns with industry standards and enables a global institution catalog.

## Architecture Decisions
1. **Global institutions use `userId = null`** — BANK and BROKERAGE are global; userId is null.
2. **PHILANTHROPY stays user-specific** — Charities are user-managed; userId required.
3. **Untyped Business records stay user-specific** — Generic contacts retain userId.
4. **`FinancialAccount.userId` is unchanged** — Always required; accounts are user-owned.
5. **Industry precedent** — Aligns with Mint, YNAB, Monarch, Empower, Copilot Money.
6. **`onDelete: SetNull` on Business.user** — Orphaned PHILANTHROPY records are preserved.
7. **`/settings/banks` is admin-only** — Only admins can create global BANK records.
8. **No dedicated Brokerage UI yet** — Out of scope for this change.
9. **Quick-create `business.create` mutation** — Handles both global and user-specific creation.
10. **`getBrokeragesWithAccounts` returns global brokerages + user's accounts** — Users see all brokerages, only their accounts.

## Schema Diff
**Before:**
```prisma
model Business {
  ...
  userId String
  user   User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```
**After:**
```prisma
model Business {
  ...
  userId String?
  user   User? @relation(fields: [userId], references: [id], onDelete: SetNull)
}
```

## Component/Service Change Summary
- `prisma/schema.prisma`: userId nullable, onDelete: SetNull
- `bank.service.ts`: addBankDetails always sets userId: null
- `business.service.ts`: getBusinessDetailsByType branches on type
- `bank.controller.ts`: addBankDetailsHandler ignores userId
- `business.controller.ts`: addBusinessDetailsHandler handles global/user
- `bank.ts` router: passes userId, ignored by handler
- `business.ts` router: getBrokeragesWithAccounts, create mutation updated

## Success Criteria
- BANK/BROKERAGE records are global (userId=null)
- PHILANTHROPY/business contacts are user-specific
- FinancialAccount always user-owned
- Uniqueness enforced globally for BANK/BROKERAGE, per-user for others
- Migration does not break existing user data
- All tests pass (unit, integration)

## Out of Scope / Future Phases
| Area                        | Status      |
|-----------------------------|-------------|
| Dedicated Brokerage UI       | Out of scope|
| Admin role check for globals | Out of scope|
| Non-admin BANK creation      | Out of scope|
| UI filter for institution    | Out of scope|
| PHILANTHROPY as global       | Out of scope|
