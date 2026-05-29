# Transfer Resolution UX — LLD

## Phase Map

| Phase | Scope | Status | Files |
|---|---|---|---|
| P0 | Retroactive auto-detection: score-based pairing + Category Rule application | ✅ Implemented | transfer.service.ts (runRetroactiveDetection) + transfer.ts (mutation) + OrphanResolutionPanel.tsx (button) |
| P1 | Category picker in resolution flow | ✅ Implemented | OrphanResolutionPanel.tsx (UI only, uses existing resolveOrphan) |
| P2 | Re-classify resolved orphans | ✅ Implemented | transfer.ts (getResolvedOrphans + resetOrphanResolution) + OrphanResolutionPanel.tsx (resolved section) |
| P3 | Link to counterpart + Unlink (surface TransferLinkDrawer in orphan panel) | ✅ Implemented | transfer.ts (getLinkedTransferPairs) + OrphanResolutionPanel.tsx (4th Link button, linked pairs section, DEBIT/CREDIT badges, save-as-rule checkbox) |
| P4 | Undo toast (5-second undo after resolution) | 🔲 Future | OrphanResolutionPanel.tsx |

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
| Run auto-detection pairs DEBIT+CREDIT orphans with score >= 70 | service | scoreCandidate drives Pass 1 pairing |
| Run auto-detection applies Category Rules to unmatched orphans | service | Pass 2 reclassifies via active rules |
| Run auto-detection returns correct pairedCount/categorisedCount/remainingCount | service | Summary stats accurate |
| Conflict resolution: same CREDIT claimed by two DEBITs → highest score wins | service | No double-linking |

## P0: runRetroactiveDetection Interface

```typescript
// src/server/services/transactions/transfer.service.ts
export async function runRetroactiveDetection(params: {
  prisma: PrismaClient;
  userId: string;
}): Promise<{ pairedCount: number; categorisedCount: number; remainingCount: number }>

// Algorithm:
// Pass 1 — Score-based pairing (score >= 70 threshold):
//   1. Fetch all unresolved DEBIT orphans + CREDIT orphans
//   2. Score each DEBIT→CREDIT pair using scoreCandidate()
//   3. Resolve conflicts (one CREDIT per DEBIT, highest score wins)
//   4. Link pairs using existing linkTransferPair()
//
// Pass 2 — Category Rule application:
//   1. Re-fetch unresolved orphans after Pass 1
//   2. Match description against active CategoryRules (CONTAINS/STARTS_WITH/EXACT)
//   3. updateMany: category = rule.category, source = 'USER_OVERRIDE'
//   4. Increment rule.appliedCount

// tRPC router: transfer.runRetroactiveDetection (protectedProcedure, no input, returns summary)
```

## File Inventory

| File | Action | Description |
|---|---|---|
| `src/server/services/transactions/transfer.service.ts` | MODIFY | Add `runRetroactiveDetection` (P0 two-pass detection) |
| `src/server/trpc/router/transfer.ts` | MODIFY | Add `runRetroactiveDetection` mutation + `getResolvedOrphans` query + `resetOrphanResolution` mutation + `getLinkedTransferPairs` query |
| `src/app/(authorized)/cashflow/transactions/_components/transfer/OrphanResolutionPanel.tsx` | MODIFY | Full rewrite: category picker (P1), resolved section + re-classify (P2), Link button + linked pairs section + DEBIT/CREDIT badges + save-as-rule checkbox (P3), "Run auto-detection" button (P0) |

## Edge Cases
- User tries to reset a transfer they do not own → forbidden
- User tries to reset a transfer that is already unresolved → forbidden
- User tries to reset a linked transfer → forbidden
- More than 50 resolved orphans → only 50 most recent shown
- Category lists are empty → disable confirm button, show message
- User cancels category selection → returns to initial state
- P0 conflict: same CREDIT orphan scores ≥70 with multiple DEBITs → highest score DEBIT wins
- P0 edge: detection run with 0 active rules → Pass 2 skipped cleanly, returns 0 categorised
- P0 edge: no orphans exist → returns `{ pairedCount: 0, categorisedCount: 0, remainingCount: 0 }`
