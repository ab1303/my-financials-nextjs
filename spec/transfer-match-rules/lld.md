# Transfer Match Rules — Low-Level Design

**Feature:** `transfer-match-rules`

---

## Phase Map

| Phase | Files Changed | Description |
|---|---|---|
| **1a** | `TransactionRow.tsx` | Add Unlink button for transfer-linked rows |
| **1b** | `transfer.ts` (router), `transfer.service.ts`, `TransferLinkDrawer.tsx`, `SmartMatchDialog.tsx` (new) | Smart Match dialog — suggest similar pairs after manual link |
| **2a** | `transfer-rule.service.ts` (new), `transfer-rule.ts` (new router), `SmartMatchDialog.tsx`, `prisma/schema.prisma` | Rule Registry — save confirmed pattern as a named rule |
| **2b** | `transfer-rule-job.service.ts` (new), CSV confirm step, `PostImportMatchBanner.tsx` (new), `prisma/schema.prisma` | Auto-match job on CSV import completion |
| **2c** | `settings/transfer-rules/page.tsx` (new), `TransferRulesTable.tsx` (new), `RuleMatchHistoryDrawer.tsx` (new) | Rule Management UI |

---

## Phase 1a — Unlink Transfer Button

### Change in `TransactionRow.tsx`

Add detection and conditional rendering alongside the existing `onLinkTransfer` button:

```typescript
// Existing props — no change
interface TransactionRowProps {
  transaction: LedgerTransactionRow;  // already has transferLinkedTransactionId in the type
  onLinkTransfer?: () => void;
  onVoided?: () => void;
  // ... rest unchanged
}

// In the render — action cell
// Existing:
{onLinkTransfer && !transaction.transferLinkedTransactionId && (
  <button onClick={onLinkTransfer} ...>Link</button>
)}

// New — add after the Link button:
{transaction.transferLinkedTransactionId && (
  <UnlinkTransferButton transactionId={transaction.id} onUnlinked={onUnlinked} />
)}
```

### New `UnlinkTransferButton` component (inline or separate file)

```typescript
'use client';

interface UnlinkTransferButtonProps {
  transactionId: string;
  onUnlinked: () => void;
}

export function UnlinkTransferButton({ transactionId, onUnlinked }: UnlinkTransferButtonProps) {
  const unlinkMutation = trpc.transfer.unlink.useMutation({
    onSuccess: () => {
      toast.success('Transfer unlinked');
      onUnlinked();
    },
    onError: (err) => toast.error(err.message ?? 'Failed to unlink transfer'),
  });

  return (
    <button
      type="button"
      aria-label="Unlink transfer"
      title="Unlink transfer"
      disabled={unlinkMutation.isPending}
      onClick={() => unlinkMutation.mutate({ transactionId })}
      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 disabled:opacity-50"
    >
      {/* chain-break icon — use react-icons/pi: PiLinkBreak */}
      <PiLinkBreak className="h-4 w-4" />
    </button>
  );
}
```

### `LedgerTransactionRow` type addition

The `transferLinkedTransactionId` field must be exposed from `transaction-ledger.ts` router output. Verify it is already selected; if not, add to the `select` object in `getAll`.

### TDD Test Cases — Phase 1a

| Test description | Type | What it verifies |
|---|---|---|
| `TransactionRow` renders chain-break button when `transferLinkedTransactionId` is non-null | Unit (RTL) | Conditional render logic |
| `TransactionRow` does not render chain-break button when `transferLinkedTransactionId` is null | Unit (RTL) | No false positive unlink button |
| Clicking Unlink button calls `trpc.transfer.unlink` with the correct `transactionId` | Unit (RTL + mock) | Correct mutation invocation |
| `unlinkTransferPair` service restores `preLinkCategory` and `preLinkStatus` to both DEBIT and CREDIT | Unit (service) | Pre-link restore correctness |

---

## Phase 1b — Smart Match Dialog

### New tRPC procedures in `transfer.ts` router

```typescript
const suggestSimilarPairsSchema = z.object({
  debitTransactionId: z.string().min(1),
  creditTransactionId: z.string().min(1),
});

const batchLinkSchema = z.object({
  pairs: z.array(z.object({
    debitTransactionId: z.string().min(1),
    creditTransactionId: z.string().min(1),
  })).min(1).max(50),
});

// Add to transferRouter:
suggestSimilarPairs: protectedProcedure
  .input(suggestSimilarPairsSchema)
  .query(async ({ ctx, input }) => {
    return findSimilarUnmatchedPairs({
      prisma: ctx.prisma,
      userId: ctx.session.user.id,
      debitTransactionId: input.debitTransactionId,
      creditTransactionId: input.creditTransactionId,
    });
  }),

batchLink: protectedProcedure
  .input(batchLinkSchema)
  .mutation(async ({ ctx, input }) => {
    return batchLinkTransferPairs({
      prisma: ctx.prisma,
      userId: ctx.session.user.id,
      pairs: input.pairs,
    });
  }),
```

### New service functions in `transfer.service.ts`

```typescript
export interface SimilarPairSuggestion {
  debit: {
    transactionId: string;
    date: string;
    description: string;
    amount: number;
    bankAccountName: string;
    bankName: string | null;
  };
  credit: {
    transactionId: string;
    date: string;
    description: string;
    amount: number;
    bankAccountName: string;
    bankName: string | null;
  };
  confidenceScore: number;
  scoreBreakdown: TransferCandidateScore['scoreBreakdown'];
  dayGap: number;
  amountDiffWarning: string | null;
}

export interface BatchLinkResult {
  linkedCount: number;
  errors: Array<{ debitId: string; creditId: string; message: string }>;
}

/**
 * Extract a match pattern from a confirmed debit/credit pair.
 * Keywords are lowercased tokens, with common stop-words filtered.
 */
export function extractPatternFromPair(params: {
  debit: { description: string; amount: Decimal; date: Date; bankAccountId: string | null; bankId: string | null };
  credit: { description: string; amount: Decimal; date: Date; bankAccountId: string | null; bankId: string | null };
}): {
  amountExact: Decimal;
  debitKeywords: string[];
  creditKeywords: string[];
  maxDayGap: number;
  debitBankAccountId: string | null;
  creditBankAccountId: string | null;
}

const STOP_WORDS = new Set(['to', 'from', 'the', 'a', 'an', 'and', 'or', 'of', 'in', 'at', 'on', 'for', 'app']);

/**
 * Find all unmatched Transfer transaction pairs that share a similar pattern
 * to the given confirmed pair. Returns pairs scored ≥ 20.
 */
export async function findSimilarUnmatchedPairs(params: {
  prisma: PrismaClient;
  userId: string;
  debitTransactionId: string;
  creditTransactionId: string;
}): Promise<SimilarPairSuggestion[]>

/**
 * Batch-link N transfer pairs. Calls linkTransferPair() per pair.
 * Partial failure is isolated — errors are collected, successes are committed.
 */
export async function batchLinkTransferPairs(params: {
  prisma: PrismaClient;
  userId: string;
  pairs: Array<{ debitTransactionId: string; creditTransactionId: string }>;
}): Promise<BatchLinkResult>
```

### `SmartMatchDialog.tsx` — Component Interface

```typescript
'use client';

interface SmartMatchDialogProps {
  open: boolean;
  onClose: () => void;
  /** The pair just manually confirmed — used as the pattern source */
  sourcePair: {
    debitTransactionId: string;
    creditTransactionId: string;
    amount: number;
    description: string;
  };
  onBatchLinked: (linkedCount: number) => void;
}

// Internal state
type DialogStep = 'loading' | 'review' | 'saving-rule' | 'done';
```

**UX flow inside `SmartMatchDialog`:**

```
Step 1 — Loading: "Scanning for similar unmatched transfers…"
  → trpc.transfer.suggestSimilarPairs.useQuery fires
  → If 0 results: auto-dismiss with toast "No similar pairs found"
  → If ≥ 1: transition to Step 2

Step 2 — Review:
  Header: "Smart Match — N similar pairs found"
  Subtext: "Based on $X · [keywords] pattern"
  [ ] Pair row (pre-checked if score ≥ 85, unchecked if 40–84)
  Footer: [Skip] [Match Selected (N) →]

Step 3 — After "Match Selected":
  Inline prompt: "Save this pattern as a rule for future imports?"
  Input: rule name (pre-filled from description keywords)
  [Skip] [Save Rule]

Step 4 — Done: dialog closes, parent refreshes
```

### Changes to `TransferLinkDrawer.tsx`

```typescript
// In onSuccess of linkMutation:
onSuccess: (result) => {
  toast.success(`Transfer linked successfully${action}`);
  onLinked();         // existing
  onClose();          // existing
  // NEW:
  setSmartMatchOpen(true);  // triggers SmartMatchDialog
},

// SmartMatchDialog rendered via createPortal alongside the existing drawer
```

### TDD Test Cases — Phase 1b

| Test description | Type | What it verifies |
|---|---|---|
| `extractPatternFromPair` strips stop-words and returns lowercased non-trivial tokens | Unit | Keyword extraction correctness |
| `findSimilarUnmatchedPairs` returns pairs matching amount exactly and within day gap | Unit (service, seeded DB) | Core scoring / pair detection |
| `findSimilarUnmatchedPairs` excludes already-linked transactions | Unit | No double-match |
| `batchLinkTransferPairs` with 3 valid pairs returns `{ linkedCount: 3, errors: [] }` | Unit | Batch happy path |
| `batchLinkTransferPairs` where pair 2 is already linked returns `{ linkedCount: 2, errors: [{ ... }] }` | Unit | Partial failure isolation |
| `SmartMatchDialog` renders N pre-checked rows when confidenceScore ≥ 85 | Unit (RTL) | Pre-selection logic |
| `SmartMatchDialog` renders unchecked rows for scores 40–84 | Unit (RTL) | Opt-in for low-confidence |
| "Match Selected" button disabled when 0 pairs are checked | Unit (RTL) | Guard against empty submit |

---

## Phase 2a — Rule Registry

### Prisma Migration

```sql
-- Migration: add_transfer_match_rules
CREATE TABLE "TransferMatchRule" (
  "id"                  TEXT NOT NULL DEFAULT gen_random_uuid(),
  "userId"              TEXT NOT NULL,
  "name"                TEXT NOT NULL,
  "isActive"            BOOLEAN NOT NULL DEFAULT true,
  "amountExact"         MONEY,
  "amountMin"           MONEY,
  "amountMax"           MONEY,
  "debitKeywords"       TEXT[] NOT NULL DEFAULT '{}',
  "creditKeywords"      TEXT[] NOT NULL DEFAULT '{}',
  "maxDayGap"           INTEGER NOT NULL DEFAULT 5,
  "debitBankAccountId"  TEXT,
  "creditBankAccountId" TEXT,
  "confidenceThreshold" INTEGER NOT NULL DEFAULT 85,
  "matchCount"          INTEGER NOT NULL DEFAULT 0,
  "lastMatchedAt"       TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TransferMatchRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TransferMatchRule_userId_isActive_idx" ON "TransferMatchRule"("userId", "isActive");
ALTER TABLE "TransferMatchRule" ADD CONSTRAINT "TransferMatchRule_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

### New service: `transfer-rule.service.ts`

```typescript
export interface CreateRuleInput {
  userId: string;
  name: string;
  amountExact: Decimal;
  debitKeywords: string[];
  creditKeywords: string[];
  maxDayGap: number;
  debitBankAccountId: string | null;
  creditBankAccountId: string | null;
  confidenceThreshold?: number; // default 85
}

export interface RuleListItem {
  id: string;
  name: string;
  isActive: boolean;
  amountExact: number | null;
  debitKeywords: string[];
  creditKeywords: string[];
  maxDayGap: number;
  confidenceThreshold: number;
  matchCount: number;
  lastMatchedAt: string | null;
}

export async function createRule(params: CreateRuleInput & { prisma: PrismaClient }): Promise<RuleListItem>

export async function listRules(params: { prisma: PrismaClient; userId: string }): Promise<RuleListItem[]>

export async function toggleRule(params: {
  prisma: PrismaClient;
  userId: string;
  ruleId: string;
  isActive: boolean;
}): Promise<void>

export async function deleteRule(params: {
  prisma: PrismaClient;
  userId: string;
  ruleId: string;
}): Promise<void>
```

### New tRPC router: `transfer-rule.ts`

```typescript
const createRuleSchema = z.object({
  name: z.string().min(1).max(100),
  amountExact: z.number().positive(),
  debitKeywords: z.array(z.string()).min(1).max(20),
  creditKeywords: z.array(z.string()).min(1).max(20),
  maxDayGap: z.number().int().min(1).max(30).default(5),
  debitBankAccountId: z.string().nullable(),
  creditBankAccountId: z.string().nullable(),
  confidenceThreshold: z.number().int().min(40).max(100).default(85),
});

const toggleRuleSchema = z.object({
  ruleId: z.string().min(1),
  isActive: z.boolean(),
});

const deleteRuleSchema = z.object({
  ruleId: z.string().min(1),
});

export const transferRuleRouter = router({
  createRule: protectedProcedure.input(createRuleSchema).mutation(...),
  listRules: protectedProcedure.query(...),
  toggleRule: protectedProcedure.input(toggleRuleSchema).mutation(...),
  deleteRule: protectedProcedure.input(deleteRuleSchema).mutation(...),
  getJobResults: protectedProcedure
    .input(z.object({ importSessionId: z.string() }))
    .query(...),
});
```

### `SmartMatchDialog` rule-save prompt (inline after batch confirm)

After `batchLink` succeeds, render an inline card at the bottom of the dialog:

```typescript
interface SaveRulePromptProps {
  suggestedName: string;      // pre-filled from description keywords
  ruleInput: CreateRuleInput; // pre-populated from extractPatternFromPair
  onSaved: (ruleId: string) => void;
  onSkip: () => void;
}
```

### TDD Test Cases — Phase 2a

| Test description | Type | What it verifies |
|---|---|---|
| `createRule` persists all fields and returns `RuleListItem` with correct values | Unit (service) | DB write correctness |
| `createRule` with duplicate `name + userId` should succeed (names are not unique-constrained) | Unit | No false constraint error |
| `toggleRule` flips `isActive` without changing other fields | Unit (service) | Partial update safety |
| `deleteRule` owned by a different user throws Unauthorized | Unit (service) | Ownership guard |
| `listRules` returns rules ordered by `createdAt DESC` | Unit (service) | Sort order |

---

## Phase 2b — Auto-Match Job on Import

### Prisma Migration (addendum to Phase 2a migration)

```sql
CREATE TABLE "TransferMatchJobResult" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid(),
  "userId"          TEXT NOT NULL,
  "importSessionId" TEXT NOT NULL,
  "ruleId"          TEXT,
  "autoLinkedCount" INTEGER NOT NULL DEFAULT 0,
  "flaggedCount"    INTEGER NOT NULL DEFAULT 0,
  "skippedCount"    INTEGER NOT NULL DEFAULT 0,
  "reviewedAt"      TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TransferMatchJobResult_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TransferMatchJobResult_userId_importSessionId_idx"
  ON "TransferMatchJobResult"("userId", "importSessionId");
ALTER TABLE "TransferMatchJobResult"
  ADD CONSTRAINT "TransferMatchJobResult_importSessionId_fkey"
  FOREIGN KEY ("importSessionId") REFERENCES "ImportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransferMatchJobResult"
  ADD CONSTRAINT "TransferMatchJobResult_ruleId_fkey"
  FOREIGN KEY ("ruleId") REFERENCES "TransferMatchRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

### New service: `transfer-rule-job.service.ts`

```typescript
export interface JobSummary {
  rulesRan: number;
  autoLinkedCount: number;
  flaggedCount: number;
  skippedCount: number;
  jobResultIds: string[];
}

export interface FlaggedPair {
  debitTransactionId: string;
  creditTransactionId: string;
  confidenceScore: number;
  ruleId: string;
  ruleName: string;
}

/**
 * Run all active TransferMatchRules for the user against new transactions
 * from the given import session. Called synchronously after import COMPLETED.
 */
export async function runTransferMatchRules(params: {
  prisma: PrismaClient;
  userId: string;
  importSessionId: string;
}): Promise<JobSummary>

// Internal algorithm:
// 1. Load active rules: WHERE userId = ? AND isActive = true
// 2. Load new Transfer-categorised transactions from this import session
// 3. For each rule:
//    a. Filter new transactions by amount (exact or range) and bank account constraints
//    b. For each filtered transaction, call getCandidates() against ALL unmatched transfers
//    c. Score each candidate against rule pattern (scoreCandidate + keyword boost)
//    d. score >= rule.confidenceThreshold AND both sides still unlinked → linkTransferPair → autoLinkedCount++
//    e. score 40–threshold → FlaggedPair → flaggedCount++
//    f. score < 40 → skippedCount++
// 4. Write TransferMatchJobResult per rule
// 5. Update rule.matchCount and rule.lastMatchedAt
// 6. Return JobSummary
```

### Hook into CSV import flow

In the CSV import confirmation step (after `ImportSession` status → COMPLETED), add:

```typescript
// After all transactions saved and ImportSession updated to COMPLETED:
const jobSummary = await runTransferMatchRules({
  prisma: ctx.prisma,
  userId: ctx.session.user.id,
  importSessionId: session.id,
});

// Return jobSummary alongside existing confirm response so client can show banner
return { ...existingResponse, matchJobSummary: jobSummary };
```

### `PostImportMatchBanner.tsx`

```typescript
'use client';

interface PostImportMatchBannerProps {
  importSessionId: string;
  autoLinkedCount: number;
  flaggedCount: number;
  onReviewFlagged: () => void;
  onDismiss: () => void;
}

// Renders:
// ✅ "8 transfers auto-linked" (if autoLinkedCount > 0)
// ⚠️  "3 pairs need review" with [Review →] button (if flaggedCount > 0)
// Dismissible — persisted to localStorage keyed by importSessionId
```

### TDD Test Cases — Phase 2b

| Test description | Type | What it verifies |
|---|---|---|
| `runTransferMatchRules` with 0 active rules returns `{ rulesRan: 0, autoLinkedCount: 0, ... }` | Unit (service) | No-op when registry empty |
| `runTransferMatchRules` auto-links a pair that exactly matches a rule (amount + keywords + gap) | Integration (seeded DB) | Happy path auto-link |
| `runTransferMatchRules` does NOT link a pair where one transaction is already linked | Integration | Double-match guard |
| `runTransferMatchRules` flags (not links) pairs scoring between 40 and `confidenceThreshold` | Integration | Flagging logic |
| Rule's `matchCount` is incremented after a successful auto-link | Integration | Stats tracking |
| `TransferMatchJobResult` is written with correct counts after job run | Integration | Result persistence |
| `runTransferMatchRules` with a disabled rule (`isActive = false`) skips that rule entirely | Unit (service) | Active filter |

---

## Phase 2c — Rule Management UI

### Page structure

```
src/app/(authorized)/settings/transfer-rules/
  page.tsx                     ← Server Component — fetch rules, pass to client
  _components/
    TransferRulesTable.tsx     ← Client Component
    RuleMatchHistoryDrawer.tsx ← Client Component (drawer)
    EditRuleInlineForm.tsx     ← Client Component (inline expand-to-edit)
```

### `page.tsx` (Server Component)

```typescript
import { auth } from '@/server/auth';
import { listRules } from '@/server/services/transactions/transfer-rule.service';

export default async function TransferRulesPage() {
  const session = await auth();
  const rules = await listRules({ prisma, userId: session.user.id });
  return <TransferRulesTable initialRules={rules} />;
}
```

### `TransferRulesTable.tsx` — Component interface

```typescript
interface TransferRulesTableProps {
  initialRules: RuleListItem[];
}

// Renders a table with columns:
// Name | Amount | Gap | Threshold | Matches | Last Run | Active
// Row actions: [Edit ▾] [History] [Delete]
// Edit expands inline (not modal) — changes name, maxDayGap, confidenceThreshold
// Delete shows inline confirmation: "This will not unlink existing pairs."
```

### `RuleMatchHistoryDrawer.tsx` — Component interface

```typescript
interface RuleMatchHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  ruleId: string;
  ruleName: string;
}

// Uses trpc.transferRule.getJobResults.useQuery({ ruleId })
// Shows list of ImportSession dates with auto-linked / flagged counts
// Expandable to show specific transaction pairs that were linked
```

### TDD Test Cases — Phase 2c

| Test description | Type | What it verifies |
|---|---|---|
| `TransferRulesTable` renders all rules with correct name, amount, and active state | Unit (RTL) | Table render |
| Toggling active switch calls `trpc.transferRule.toggleRule` with correct ruleId and new state | Unit (RTL + mock) | Toggle mutation |
| Delete button shows inline confirmation before calling `deleteRule` | Unit (RTL) | Destructive action guard |
| `RuleMatchHistoryDrawer` shows "No match history yet" when `jobResults` is empty | Unit (RTL) | Empty state |

---

## Migration Notes

### Order of operations (stop dev server first)

```bash
# 1. Stop dev server (prevents EPERM on Windows)
# 2. Add TransferMatchRule and TransferMatchJobResult to prisma/schema.prisma
# 3. Add relations to User and ImportSession
pnpm prisma migrate dev --name add_transfer_match_rules
# 4. Restart dev server
pnpm run dev
```

### Non-breaking guarantee

- Both new tables are additions only — no existing columns changed.
- `ruleId` on `TransferMatchJobResult` is nullable (`ON DELETE SET NULL`) so deleting a rule does not delete job history.
- `ImportSession` and `User` gain new relations (reverse side) — no column migration needed for those.

---

## Integration Points & Edge Cases

| Scenario | Handling |
|---|---|
| Import session has 0 Transfer-categorised transactions | `runTransferMatchRules` returns early after loading 0 new transactions |
| Two rules match the same unmatched pair | First rule to score above threshold wins; second rule re-checks `transferLinkedTransactionId` is still null and skips |
| `batchLink` called with a pair where debit and credit are same account | `linkTransferPair` throws "must be different accounts" — captured in `errors[]` |
| User deletes a rule that has auto-linked pairs | Pairs remain linked (`ruleId` on `TransferMatchJobResult` nulled via `SET NULL`); existing links are not reversed |
| CSV import fails mid-way (`ImportSession.status = PARTIAL`) | `runTransferMatchRules` is only called on `COMPLETED` status — partial imports are excluded |
| Smart Match dialog dismissed (Skip) | No rule created, no batch link — existing manual link stands; dialog state is local, no DB side effect |
| `findSimilarUnmatchedPairs` returns 0 results | `SmartMatchDialog` auto-dismisses with a subtle toast: "No similar unmatched pairs found" |
