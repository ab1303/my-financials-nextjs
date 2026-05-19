# context.md

## Problem Summary
The Bank Institution settings UI previously included address fields, which are now obsolete since banks are global. After removing these fields, the UI has excessive empty space. The goal is to redesign the UI for efficient use of space, focusing on a compact, inline-add form and a clear list of global bank institutions. All address-related logic must be removed from the bank institution flow.

## File Inventory
| File                                                      | Action  | Description                                                      |
|-----------------------------------------------------------|---------|------------------------------------------------------------------|
| src/app/(authorized)/settings/banks/form.tsx              | MODIFY  | Redesign to compact inline-add + table list, no address fields   |
| src/app/(authorized)/settings/banks/page.tsx              | MODIFY  | Ensure page layout matches new UX                                |
| src/server/controllers/bank.controller.ts                 | MODIFY  | Remove address logic, only handle name/type                      |
| src/server/schema/bank.schema.ts                          | MODIFY  | Remove address validation, only validate name                    |
| src/types/businessTypes.ts                                | MODIFY  | Remove address from BankType                                     |

## Schema Details
```prisma
enum BusinessEnumType {
  BANK
  PHILANTHROPY
  BROKERAGE
}

model Business {
  id               String               @id @default(cuid())
  name             String
  addressLine      String?
  streetAddress    String?
  suburb           String?
  postcode         Int?
  state            String?
  type             BusinessEnumType?
  bankInterestPayments BankInterestPayment[]
  bankInterestLiabilities BankInterestLiability[]
  zakatPayments    ZakatPayment[]
  donationPayments DonationPayment[]
  financialAccounts FinancialAccount[]
  // userId is null for global/admin-managed institutions (BANK, BROKERAGE).
  // userId is set for user-specific institutions (e.g. PHILANTHROPY).
  userId           String?
  user             User?                @relation(fields: [userId], references: [id], onDelete: SetNull)
}
```

- Only `name` and `type` are relevant for banks (type = BANK, userId = null)
- Address fields remain in schema for other institution types

## Existing Patterns to Reuse
- tRPC router at `src/server/trpc/router/`
- tRPC client: `import { trpc } from '@/server/trpc/client'`
- Toast notifications: `import { toast } from 'sonner'`
- Table/list display and inline form patterns from other settings UIs

## Data Flow Diagrams

### Current
```
[Form w/ Address Fields] → [Controller: Validates All Fields] → [Prisma: Business]
```

### Proposed
```
[Inline Add Form (name)] → [Controller: Validates Name Only] → [Prisma: Business]
                                 ↓
                        [Table/List of Banks]
```

## Known Constraints / Gotchas
- Do not remove address columns from schema (shared with philanthropy)
- Only global/admin-managed banks (userId = null) are affected
- No changes to user-specific institution flows
- All changes must be TypeScript, App Router, T3 stack compliant
- No migration required
