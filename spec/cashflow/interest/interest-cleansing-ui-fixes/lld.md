# Interest Cleansing UI Fixes — Low Level Design (LLD)

## Phase Map
| Phase | Description |
|---|---|
| 1. Drawer Fix | Ensure drawer calls `getUnlinkedInterestTransactions` |
| 2. Cleanup | Script to delete broken fiscal year BankInterestLiability records |
| 3. UX Refactor | UI always shows 12 months, removes init button, supports inline manual override |

## Phase 1: Drawer Fix
- **Function:**
```typescript
// Already implemented
async function getUnlinkedInterestTransactions(bankId: string, dateFrom: Date, dateTo: Date, userId: string): Promise<Transaction[]>;
```
- **Interface Diff:** Drawer now expects array of CREDIT transactions for the selected period.
- **Zod Schema:**
```typescript
import { z } from 'zod';
export const UnlinkedInterestTransactionSchema = z.object({
  id: z.string(),
  date: z.date(),
  amount: z.number(),
  description: z.string(),
  status: z.string(),
});
```
- **TDD Test Cases:**
1. Returns all unlinked CREDIT transactions for bank/year
2. Excludes already-linked transactions
3. Handles empty result set gracefully

## Phase 2: Cleanup
- **Script:**
```typescript
// scripts/cleanup-fiscal-interest.ts
import { prisma } from '@/server/db';

async function cleanupFiscalInterestLiabilities() {
  await prisma.bankInterestLiability.deleteMany({
    where: {
      calendar: {
        type: 'FISCAL',
      },
      // Add filter for known-bad months if needed
    },
  });
}
```
- **TDD Test Cases:**
1. Deletes only FISCAL year liabilities
2. Does not affect ANNUAL/ZAKAT records
3. Allows user to re-initialize without error

## Phase 3: UX Refactor
- **Function:**
```typescript
// src/server/services/bank-interest/interest-cleansing.service.ts
export async function getYearlyCleansingData(bankId: string, calendarYearId: string, userId: string): Promise<YearlyCleansingData>;
```
- **UI Component:**
```typescript
// src/app/(authorized)/cashflow/bank-interest/InterestCreditsTable.tsx
// Remove init button, always render 12 months, support inline manual override
```
- **Zod Schema:**
```typescript
import { z } from 'zod';
export const ManualOverrideSchema = z.object({
  month: z.number().min(1).max(12),
  year: z.number(),
  amount: z.number().optional(),
});
```
- **TDD Test Cases:**
1. Table always shows 12 months for selected year
2. Manual override can be set per month
3. FROM LEDGER column always shows matched transactions

## File Inventory
| File | Action |
|---|---|
| src/server/services/bank-interest/interest-cleansing.service.ts | MODIFY |
| src/app/(authorized)/cashflow/bank-interest/InterestCreditsTable.tsx | MODIFY |
| scripts/cleanup-fiscal-interest.ts | CREATE |

## Migration Notes
- All fiscal year BankInterestLiability records created before the month calculation fix must be deleted and recreated by the user via the UI.
- Cleanup script must be run before deploying the new UI.

## Integration Points
- Drawer fix is prerequisite for UI refactor
- Cleanup script must run before user can use new UI
- UI depends on getYearlyCleansingData always returning 12 months
