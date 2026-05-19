# Business Global Institutions — Low-Level Design (LLD)

## What Was Implemented
A single-phase change: `Business.userId` is now nullable. BANK and BROKERAGE are global (`userId=null`), PHILANTHROPY and untyped remain user-specific. All affected services, controllers, and routers updated for correct ownership logic and uniqueness checks.

## Function Signatures (as implemented)
```typescript
// src/server/services/bank.service.ts
export const addBankDetails = async (
  input: Omit<Prisma.BusinessUncheckedCreateInput, 'userId'>
) => Promise<Business>;

// src/server/services/business.service.ts
export const addBusinessDetails = async (
  input: Prisma.BusinessUncheckedCreateInput,
) => Promise<Business>;
export const getBusinessDetailsByType = async (
  userId: string,
  type?: string,
) => Promise<Business[]>;

// src/server/controllers/bank.controller.ts
export const addBankDetailsHandler = async ({
  input,
  userId?: string,
}: {
  input: CreateBankInput;
  userId?: string;
}) => Promise<{ status: string; data: { bank: Business } }>;

// src/server/controllers/business.controller.ts
export const addBusinessDetailsHandler = async ({ input, userId }: { input: CreateBusinessInput; userId: string }) => Promise<{ status: string; data: { business: Business } }>;

// src/server/trpc/router/business.ts
create: protectedProcedure
  .input(z.object({ name: z.string().min(1), type: z.enum(['PHILANTHROPY', 'BROKERAGE']).optional() }))
  .mutation(...)
getBrokeragesWithAccounts: protectedProcedure.query(...)
```

## TDD Test Cases
| Test                                         | Type      | Verifies                                                      |
|----------------------------------------------|-----------|---------------------------------------------------------------|
| Create BANK as global                        | Unit      | BANK created with userId=null                                 |
| Create BROKERAGE as global                   | Unit      | BROKERAGE created with userId=null                            |
| Create PHILANTHROPY as user                  | Unit      | PHILANTHROPY created with userId set                          |
| Uniqueness enforced for global BANK          | Unit      | Duplicate BANK (userId=null) rejected                         |
| Uniqueness enforced for user PHILANTHROPY    | Unit      | Duplicate PHILANTHROPY (same userId) rejected                 |
| getBrokeragesWithAccounts returns correct set| Integration| Only user's accounts shown under global brokerages            |
| addBankDetailsHandler ignores userId param   | Unit      | Handler ignores userId, always creates global BANK            |
| Data migration sets userId=null for globals   | Integration| BANK/BROKERAGE records updated to userId=null                 |
| Migration does not break user data           | Integration| User-specific records remain correct after migration           |

## Migration Notes
- Use `prisma db push` (not `migrate dev`) due to migration drift
- Data migration SQL:
```sql
UPDATE "Business" SET "userId" = NULL WHERE type IN ('BANK', 'BROKERAGE');
```

## Integration Points & Edge Cases
- `bank.ts` router passes userId for API compat; handler ignores
- Uniqueness: global types unique across all, user types per user
- `getBusinessDetails` is not ownership-aware; callers must filter
- Migration drift: use `prisma db push`
- `stock-asset.service.ts` logic unchanged (correct as-is)
