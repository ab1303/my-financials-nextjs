# Transfer Resolution UX — LLD

## Phase Map

| Phase | Scope | Files |
|---|---|---|
| P1 | Category picker in resolution flow | OrphanResolutionPanel.tsx (UI only, uses existing resolveOrphan) |
| P2 | Re-classify resolved orphans | transfer.ts (new query + mutation) + OrphanResolutionPanel.tsx (resolved section) |
| P3 | Link to counterpart + Unlink (surface TransferLinkDrawer in orphan panel) | transfer.ts (new getLinkedTransferPairs query) + OrphanResolutionPanel.tsx (4th Link button, linked pairs section) |

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

### tRPC Procedures (P3)

```typescript
// transfer.ts

// P3: Get linked transfer pairs for display (DEBIT side only, includes counterpart)
getLinkedTransferPairs: protectedProcedure
  .query(async ({ ctx }) => {
    return (ctx.prisma.transaction as any).findMany({
      where: {
        userId: ctx.session.user.id,
        category: TRANSFER_CATEGORY,
        type: 'DEBIT',
        transferLinkedTransactionId: { not: null },
      },
      include: {
        financialAccount: { select: { name: true } },
        transferLinkedTransaction: {
          include: { financialAccount: { select: { name: true } } },
        },
      },
      orderBy: { date: 'desc' },
      take: 50,
    });
  }),
```

### UI State (P3)

```typescript
// OrphanResolutionPanel.tsx additions

// State
const [drawerOrphanId, setDrawerOrphanId] = useState<string | null>(null);
const [showLinked, setShowLinked] = useState(false);
const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

// Props fed to TransferLinkDrawer
interface DrawerSourceTransaction {
  id: string;
  description: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  date: string;
  bankAccountId: string | null;
  bankAccountName: string | null;
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
| Link button opens TransferLinkDrawer for the correct orphan | UI | Drawer pre-populates with source transaction |
| After link, orphan disappears from unresolved list | UI | Successful link invalidates getOrphanedTransfers |
| Linked pairs appear in collapsible "Linked transfers" section | UI | getLinkedTransferPairs shown |
| Unlink button resets pair — both sides return to Transfer category | tRPC | transfer.unlink called with debit transactionId |

## File Inventory

| File | Action | Description |
|---|---|---|
| src/server/trpc/router/transfer.ts | MODIFY | Add getResolvedOrphans query, resetOrphanResolution mutation, getLinkedTransferPairs query |
| src/app/(authorized)/cashflow/transactions/_components/transfer/OrphanResolutionPanel.tsx | MODIFY | Rewrite: category picker, resolved section, Link button (4th), linked pairs section with Unlink |

## Edge Cases
- User tries to reset a transfer they do not own → forbidden
- User tries to reset a transfer that is already unresolved → forbidden
- User tries to reset a linked transfer → forbidden
- More than 50 resolved orphans → only 50 most recent shown
- Category lists are empty → disable confirm button, show message
- User cancels category selection → returns to initial state
