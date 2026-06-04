# Cleansing Donations — DEBIT Transaction Linking (LLD)

## Phase Map

| Phase | Description                                                                                          | Owner    |
| ----- | ---------------------------------------------------------------------------------------------------- | -------- |
| 1     | Service: Add `getUnlinkedCleansingDebitTransactions` (accepts configurable categoryName)             | Backend  |
| 2     | tRPC: Add query for unlinked DEBIT transactions that forwards configured categoryName                | Backend  |
| 3     | UI: Update CleanseDonationDrawer to use canonical evidence-retrieval query and DEBIT evidence fields | Frontend |

## Interfaces & Signatures

### Service Layer

```typescript
// src/server/services/bank-interest/interest-cleansing.service.ts
export async function getUnlinkedCleansingDebitTransactions(
  userId: string,
  bankAccountId: string,
  categoryName: string,
): Promise<Transaction[]>;
```

- Returns CONFIRMED DEBIT transactions filtered by the provided `categoryName` (configured interest category) for the user/bankAccount, where `donationPayment` is null.

### tRPC Router

```typescript
// src/server/trpc/router/bank-interest.ts
trpc.procedure.query('getUnlinkedCleansingDebitTransactions', {
  input: z.object({ bankAccountId: z.string() }),
  resolve: async ({ ctx, input }) =>
    getUnlinkedCleansingDebitTransactions(
      ctx.session.user.id,
      input.bankAccountId,
    ),
});
```

### UI Integration

-- Update CleanseDonationDrawer LinkedModeBody to fetch DEBIT evidence via the canonical query and default to the configured interest category
-- Update handleLinkedSave to use selected DEBIT transaction's date/amount

## TDD Test Cases

| Test                             | Type        | Verifies                                      |
| -------------------------------- | ----------- | --------------------------------------------- |
| Returns only CONFIRMED DEBITs    | unit        | Only eligible transactions are returned       |
| Excludes already-linked DEBITs   | unit        | Linked transactions are not returned          |
| UI shows correct DEBITs          | integration | Drawer surfaces only eligible DEBITs          |
| Linking sets correct date/amount | integration | DonationPayment uses DEBIT transaction fields |
| No regression to CREDIT logic    | regression  | CREDIT workflow remains unaffected            |

## Migration Notes

- No schema changes; no migration required

## Integration Points & Edge Cases

- Service must filter by userId, bankAccountId, type, category, status, and donationPayment
- UI must not show CREDIT transactions in Linked mode
- Handle empty state (no eligible DEBITs)

## File Inventory

| File                                                                               | Action |
| ---------------------------------------------------------------------------------- | ------ |
| src/server/services/bank-interest/interest-cleansing.service.ts                    | MODIFY |
| src/server/trpc/router/bank-interest.ts                                            | MODIFY |
| src/app/(authorized)/cashflow/bank-interest/\_components/CleanseDonationDrawer.tsx | MODIFY |
