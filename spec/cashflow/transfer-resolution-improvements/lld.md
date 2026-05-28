# Transfer Resolution UX — LLD

## Phase Map

| Phase | Scope | Files |
|---|---|---|
| P1 | Category picker in resolution flow | OrphanResolutionPanel.tsx (UI only, uses existing resolveOrphan) |
| P2 | Re-classify resolved orphans | transfer.ts (new query + mutation) + OrphanResolutionPanel.tsx (resolved section) |

## Interfaces & Schemas

### tRPC Procedures

```typescript
// transfer.ts

// P2: Get resolved orphans
getResolvedOrphans: protectedProcedure
  .input(z.object({ bankAccountId: z.string().optional() }))
  .query(async ({ ctx, input }) => {
    return ctx.prisma.transaction.findMany({
      where: {
        userId: ctx.session.user.id,
        category: 'Transfer',
        orphanResolution: { not: null },
        transferLinkedTransactionId: null,
        ...(input.bankAccountId ? { bankAccountId: input.bankAccountId } : {}),
      },
      orderBy: { date: 'desc' },
      take: 50,
    });
  })

// P2: Reset orphan resolution
resetOrphanResolution: protectedProcedure
  .input(z.object({ transactionId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const tx = await ctx.prisma.transaction.findUnique({
      where: { id: input.transactionId },
    });
    if (!tx || tx.userId !== ctx.session.user.id || tx.orphanResolution == null || tx.transferLinkedTransactionId) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    await ctx.prisma.transaction.update({
      where: { id: input.transactionId },
      data: { orphanResolution: null, category: 'Transfer' },
    });
    return true;
  })
```

### UI State (P1)

```typescript
// OrphanResolutionPanel.tsx

interface OrphanResolutionRowProps {
  transaction: Transaction;
  onResolve: (resolution: 'EXPENSE' | 'INCOME' | 'EXCLUDED', newCategory?: string) => void;
}

interface CategoryOption {
  id: string;
  name: string;
  description: string;
}
```

## TDD Test Cases

| Test | Type | Verifies |
|------|------|----------|
| User must select category before confirming EXPENSE/INCOME | UI | Prevents hardcoded category assignment |
| Resolved orphans appear in collapsible section | UI | User can see and reclassify past resolutions |
| Only owner can reset orphan resolution | tRPC | Security guard on mutation |
| Resetting reverts orphan to unresolved | tRPC | Transaction reappears in unresolved list |
| Excluded resolution remains single-click | UI | No category required for EXCLUDED |

## File Inventory

| File | Action | Description |
|---|---|---|
| src/server/trpc/router/transfer.ts | MODIFY | Add getResolvedOrphans query and resetOrphanResolution mutation |
| src/app/(authorized)/cashflow/transactions/_components/transfer/OrphanResolutionPanel.tsx | MODIFY | Rewrite: two-step category/source picker, resolved section with re-classify |

## Edge Cases
- User tries to reset a transfer they do not own → forbidden
- User tries to reset a transfer that is already unresolved → forbidden
- User tries to reset a linked transfer → forbidden
- More than 50 resolved orphans → only 50 most recent shown
- Category lists are empty → disable confirm button, show message
- User cancels category selection → returns to initial state
