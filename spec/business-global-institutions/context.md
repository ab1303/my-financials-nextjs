# Business Global Institutions — Context

## Problem Summary
The Business model incorrectly required every institution (Bank, Brokerage, Philanthropy) to be user-owned. Real-world financial institutions (BANK, BROKERAGE) should be global, admin-managed entities, not user-scoped. This change makes `Business.userId` nullable, so global institutions have `userId = null` and user-specific records retain a userId.

## File Inventory
| File                                         | Change Description                                                                 |
|----------------------------------------------|------------------------------------------------------------------------------------|
| prisma/schema.prisma                        | `userId` made nullable; relation onDelete: Cascade → SetNull                      |
| src/server/services/bank.service.ts          | `addBankDetails` always sets `userId: null`; no longer accepts/passes userId      |
| src/server/services/business.service.ts      | `getBusinessDetailsByType` branches on global vs user-specific type               |
| src/server/controllers/bank.controller.ts    | `addBankDetailsHandler` drops userId param; banks are global                      |
| src/server/controllers/business.controller.ts| `addBusinessDetailsHandler` uses `userId: null` for BANK/BROKERAGE               |
| src/server/trpc/router/bank.ts               | `saveBankDetails` passes userId but handler ignores it                            |
| src/server/trpc/router/business.ts           | `getBrokeragesWithAccounts` uses global filter; `create` mutation handles both    |

## Schema Details
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
  bankInterestPayments BankInterestPayment[]
  bankInterestLiabilities BankInterestLiability[]
  zakatPayments    ZakatPayment[]
  donationPayments DonationPayment[]
  financialAccounts FinancialAccount[]
  userId           String?
  user             User?                @relation(fields: [userId], references: [id], onDelete: SetNull)
}

model FinancialAccount {
  id           String               @id @default(cuid())
  name         String
  institutionId String
  institution  Business             @relation(fields: [institutionId], references: [id])
  userId       String
  user         User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  balanceRecords BankBalanceRecord[]
  stockHoldings  StockHolding[]
  createdAt    DateTime             @default(now())
  updatedAt    DateTime             @updatedAt
  transactions Transaction[]

  @@unique([name, institutionId, userId])
  @@index([userId, institutionId])
}

enum BusinessEnumType {
  BANK
  PHILANTHROPY
  BROKERAGE
}
```

### Relationships
- `Business.userId` is nullable; null means global institution
- `FinancialAccount.userId` is always required (user-owned)
- `Business.type` distinguishes BANK, BROKERAGE (global) vs PHILANTHROPY (user)

## Data Flow: Ownership Model

**Before:**
```
User ──owns──> Business (BANK, BROKERAGE, PHILANTHROPY)
                   │
                   └──owns──> FinancialAccount
```
**After:**
```
User ──owns──> Business (PHILANTHROPY, untyped)
Admin ──owns──> Business (BANK, BROKERAGE, userId=null)
User ──owns──> FinancialAccount (at global Business)
```

## Data Migration SQL
```sql
UPDATE "Business" SET "userId" = NULL WHERE type IN ('BANK', 'BROKERAGE');
```

## Known Constraints & Gotchas
- Migration drift: use `prisma db push` (not `migrate dev`) until history is cleaned
- `bank.ts` router still passes userId for API compatibility (ignored)
- Uniqueness: global types unique across all, user types unique per user
- `getBusinessDetails` is not ownership-aware; callers must filter correctly
- `stock-asset.service.ts` logic unchanged (correct as-is)
