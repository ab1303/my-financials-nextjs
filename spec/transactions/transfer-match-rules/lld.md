# Transfer Match Rules — Low Level Design

## Phase Map

| Phase | Files | Description |
|---|---|---|
| **1a** | `TransactionRow.tsx` | Unlink Transfer button (chain-break icon) |
| **1b** | `transfer.ts` router, `transfer.service.ts`, `TransferLinkDrawer.tsx`, `SmartMatchDialog.tsx` | Smart Match: `suggestSimilarPairs` + `batchLink` + dialog |
| **2a** | `transfer-rule.service.ts`, `transferRuleRouter`, `SmartMatchDialog.tsx` | Rule creation from confirmed pairs |
| **2b** | `transfer-rule-job.service.ts`, CSV confirm step, `PostImportMatchBanner.tsx` | Auto-match on import |
| **2c** | `settings/transfer-rules/page.tsx`, `TransferRulesTable.tsx`, `RuleMatchHistoryDrawer.tsx` | Rule management UI |

---

## Data Models

### `TransferMatchRule`

```prisma
model TransferMatchRule {
  id                  String    @id @default(cuid())
  userId              String
  user                User      @relation(fields: [userId], references: [id])
  name                String
  amountExact         Decimal?
  debitKeywords       String[]
  creditKeywords      String[]
  maxDayGap           Int       @default(5)
  debitBankAccountId  String?
  debitBankAccount    BankAccount? @relation("debitRules", fields: [debitBankAccountId], references: [id])
  creditBankAccountId String?
  creditBankAccount   BankAccount? @relation("creditRules", fields: [creditBankAccountId], references: [id])
  confidenceThreshold Int       @default(85)
  isActive            Boolean   @default(true)
  createdAt           DateTime  @default(now())
  matchJobResults     TransferMatchJobResult[]
}

model TransferMatchJobResult {
  id              String    @id @default(cuid())
  importSessionId String
  importSession   ImportSession @relation(fields: [importSessionId], references: [id])
  ruleId          String?
  rule            TransferMatchRule? @relation(fields: [ruleId], references: [id], onDelete: SetNull)
  autoLinked      Int       @default(0)
  flaggedForReview Int      @default(0)
  skipped         Int       @default(0)
  createdAt       DateTime  @default(now())
}
```

---

## Phase 1a — Unlink Button

In `TransactionRow.tsx`:
```tsx
{transaction.transferLinkedTransactionId !== null && (
  <button
    aria-label="Unlink transfer"
    onClick={() => onUnlink(transaction.id)}
    className="..."
  >
    <FiLink2 className="line-through" />
  </button>
)}
```

Calls `api.transfer.unlink.useMutation()` (procedure already exists in `transfer.ts` router).

---

## Phase 1b — Smart Match

### New tRPC procedures in `transfer.ts`

```typescript
suggestSimilarPairs: protectedProcedure
  .input(z.object({ confirmedDebitId: z.string(), confirmedCreditId: z.string() }))
  .query(async ({ ctx, input }) => {
    const pattern = await extractPatternFromPair(ctx.session.user.id, input.confirmedDebitId, input.confirmedCreditId);
    return findSimilarUnmatchedPairs(ctx.session.user.id, pattern);
  }),

batchLink: protectedProcedure
  .input(z.object({ pairs: z.array(z.object({ debitId: z.string(), creditId: z.string() })) }))
  .mutation(async ({ ctx, input }) => {
    const results = [];
    for (const pair of input.pairs) {
      try {
        results.push({ ...pair, success: true, result: await linkTransferPair(ctx.session.user.id, pair.debitId, pair.creditId) });
      } catch (err) {
        results.push({ ...pair, success: false, error: String(err) });
      }
    }
    return results; // partial success — errors collected, not thrown
  }),
```

### `SmartMatchDialog.tsx`

```typescript
interface SmartMatchDialogProps {
  pairs: Array<{ debit: TransactionRow; credit: TransactionRow; score: number }>;
  onConfirm: (selectedPairIds: string[][]) => void;
  onSkip: () => void;
  onSaveAsRule?: () => void;
}
```

- Renders checkbox list of candidate pairs
- "Confirm Selected" → calls `batchLink`
- "Save as rule?" inline prompt appears after confirm

---

## Phase 2a — Rule Creation

**File:** `src/server/services/transactions/transfer-rule.service.ts`

```typescript
export async function createRuleFromPair(
  userId: string,
  debitId: string,
  creditId: string,
  name: string,
): Promise<TransferMatchRule> {
  const [debit, credit] = await Promise.all([
    prisma.transaction.findUnique({ where: { id: debitId } }),
    prisma.transaction.findUnique({ where: { id: creditId } }),
  ]);

  const debitKeywords  = extractKeywords(debit!.description);
  const creditKeywords = extractKeywords(credit!.description);
  const amountExact    = debit!.amount; // use debit amount as anchor

  return prisma.transferMatchRule.create({
    data: {
      userId, name, amountExact, debitKeywords, creditKeywords,
      debitBankAccountId:  debit!.bankAccountId,
      creditBankAccountId: credit!.bankAccountId,
    },
  });
}

function extractKeywords(description: string): string[] {
  const STOP_WORDS = new Set(['to', 'from', 'the', 'a', 'an', 'in', 'at', 'of']);
  return description
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}
```

---

## Phase 2b — Auto-Match on Import

**File:** `src/server/services/transactions/transfer-rule-job.service.ts`

```typescript
export async function runTransferMatchRules(
  userId: string,
  importSessionId: string,
): Promise<TransferMatchJobResult[]> {
  const rules = await prisma.transferMatchRule.findMany({
    where: { userId, isActive: true },
  });

  const newTransactions = await prisma.transaction.findMany({
    where: { importSessionId, status: 'EXCLUDED', category: 'Transfer', transferLinkedTransactionId: null },
  });

  const results: TransferMatchJobResult[] = [];

  for (const rule of rules) {
    for (const tx of newTransactions) {
      // Re-check tx is still unlinked (earlier rule may have linked it)
      const fresh = await prisma.transaction.findUnique({ where: { id: tx.id } });
      if (fresh?.transferLinkedTransactionId) continue;

      const candidates = await getCandidates(userId, tx.id);
      const topCandidate = candidates[0];
      if (!topCandidate) continue;

      if (topCandidate.confidenceScore >= rule.confidenceThreshold) {
        await linkTransferPair(userId, tx.id, topCandidate.transactionId);
        results.push({ ruleId: rule.id, autoLinked: 1, flaggedForReview: 0, skipped: 0, importSessionId });
      } else if (topCandidate.confidenceScore >= 40) {
        results.push({ ruleId: rule.id, autoLinked: 0, flaggedForReview: 1, skipped: 0, importSessionId });
      }
    }
  }

  return results;
}
```

Call after `ImportSession` status transitions to `COMPLETED` in the confirm route.

---

## Success Criteria

| # | Criterion | How verified |
|---|---|---|
| 1 | Transfer-linked rows show Unlink button; clicking restores both transactions | Manual test + unit test |
| 2 | After manual $2,000 link, `suggestSimilarPairs` returns other unmatched $2,000 Transfer pairs within 5 days | Unit test with seeded data |
| 3 | `batchLink` 3 pairs: 3 succeed; 4th already-linked pair returns error without rolling back 3 successes | Unit test |
| 4 | Rule created from confirmed pair has correct keywords, `amountExact`, `maxDayGap`, bank account IDs | Unit test |
| 5 | After CSV upload, `runTransferMatchRules` auto-links ≥85 pairs and flags 40–84 in `TransferMatchJobResult` | Integration test |
| 6 | `PostImportMatchBanner` shows "X auto-linked · Y to review" after import | E2e smoke test |

---

## Files

| File | Action | Description |
|---|---|---|
| `prisma/schema.prisma` | MODIFY | Add `TransferMatchRule`, `TransferMatchJobResult` models |
| `src/server/services/transactions/transfer.service.ts` | MODIFY | Add `extractPatternFromPair`, `findSimilarUnmatchedPairs` |
| `src/server/api/routers/transfer.ts` | MODIFY | Add `suggestSimilarPairs` query + `batchLink` mutation |
| `src/server/services/transactions/transfer-rule.service.ts` | CREATE | `createRuleFromPair`, `listRules`, `toggleRule`, `deleteRule` |
| `src/server/services/transactions/transfer-rule-job.service.ts` | CREATE | `runTransferMatchRules` synchronous job |
| `src/server/api/routers/transfer-rule.ts` | CREATE | tRPC CRUD router for rules |
| `src/server/api/root.ts` | MODIFY | Register `transferRule` router |
| `src/components/transactions/TransactionRow.tsx` | MODIFY | Unlink chain-break icon button |
| `src/components/transactions/TransferLinkDrawer.tsx` | MODIFY | Call `suggestSimilarPairs` after link; open SmartMatchDialog |
| `src/components/transactions/SmartMatchDialog.tsx` | CREATE | Pair checkbox list + "Save as rule?" |
| `src/components/transactions/PostImportMatchBanner.tsx` | CREATE | "X auto-linked · Y to review" after import |
| `src/app/(authorized)/settings/transfer-rules/page.tsx` | CREATE | Server Component shell + pass rules to client |
| `src/components/settings/TransferRulesTable.tsx` | CREATE | Active toggle, edit name/gap, delete |
| `src/components/settings/RuleMatchHistoryDrawer.tsx` | CREATE | Transactions auto-linked by a specific rule |
