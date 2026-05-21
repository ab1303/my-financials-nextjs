# Category Sync Fixes: Interest Cleansing + Referential Integrity — LLD

## Phase Map
| Phase | Description | Depends On |
|---|---|---|
| 1 | Refactor service to use configurable category name | — |
| 2 | Update transactions on category rename | 1 |

## Interfaces & Signatures
| File | Function | Signature |
|---|---|---|
| interest-cleansing.service.ts | getUnlinkedCleansingDebitTransactions | `(userId: string, categoryName: string): Promise<Transaction[]>` |
| transaction.service.ts | updateTransactionCategory | `(oldCategory: string, newCategory: string): Promise<number>` |
| expense-category.ts (tRPC) | renameCategoryAndSyncTransactions | `(id: string, newName: string): Promise<ExpenseCategory>` |

## TDD Cases
- Renaming a category updates all transactions with the old name
- Service function finds transactions using the current category name
- No transactions are orphaned after rename
- No schema changes required

## Integration Points
- tRPC router calls service utility on category rename
- Service function uses constant/config for category name

## File Inventory
| File | Action | Purpose |
|---|---|---|
| src/server/services/bank-interest/interest-cleansing.service.ts | MODIFY | Use configurable category name |
| src/server/services/transaction.service.ts | CREATE/MODIFY | Add bulk update function |
| src/server/trpc/router/expense-category.ts | MODIFY | Call update utility on rename |
| prisma/schema.prisma | REVIEW | No changes required |

## Example Implementation Snippets

```typescript
// transaction.service.ts
export async function updateTransactionCategory(oldCategory: string, newCategory: string): Promise<number> {
  return prisma.transaction.updateMany({
    where: { category: oldCategory },
    data: { category: newCategory },
  });
}
```

```typescript
// interest-cleansing.service.ts
export async function getUnlinkedCleansingDebitTransactions(userId: string, categoryName: string): Promise<Transaction[]> {
  return prisma.transaction.findMany({
    where: {
      userId,
      type: 'DEBIT',
      category: categoryName,
      // ...other filters
    },
  });
}
```

```typescript
// expense-category.ts (tRPC)
async function renameCategoryAndSyncTransactions(id: string, newName: string): Promise<ExpenseCategory> {
  const oldCategory = await prisma.expenseCategory.findUnique({ where: { id } });
  const updated = await prisma.expenseCategory.update({ where: { id }, data: { name: newName } });
  await updateTransactionCategory(oldCategory.name, newName);
  return updated;
}
```
