# Transfer Match Rules — Context

**Feature:** `transfer-match-rules`
**Status:** Specced — ready for implementation
**Depends on:** `transfer-reconciliation` (fully implemented — `transfer.service.ts`, `transferRouter` exist)

---

## Problem Summary

The current transfer-reconciliation feature lets users manually link a DEBIT/CREDIT pair one at a time. When a user has many recurring inter-account transfers (e.g. a monthly $2,000 payback), they must scan and link each pair manually. There is no way to apply a confirmed match pattern to similar unmatched pairs, and no memory of patterns across CSV imports. This creates significant manual overhead for users with regular transfer patterns.

Two capabilities are needed:
1. **Smart Match** — after confirming a manual link, detect and suggest all similar unmatched pairs in the current dataset so the user can batch-confirm them.
2. **Rule Registry** — persist the confirmed pattern as a named rule that runs automatically whenever a new CSV is imported, linking matching pairs without user intervention.

---

## File Inventory

### Files to CREATE

| File | Role |
|---|---|
| `src/server/services/transactions/transfer-rule.service.ts` | Rule creation from pattern, rule scoring against unmatched transactions |
| `src/server/services/transactions/transfer-rule-job.service.ts` | Batch job: load rules, scan new import transactions, auto-link qualifying pairs |
| `src/server/trpc/router/transfer-rule.ts` | tRPC router: `suggestSimilarPairs`, `batchLink`, `createRule`, `listRules`, `toggleRule`, `deleteRule`, `getJobResults` |
| `src/app/(authorized)/cashflow/transactions/_components/transfer/SmartMatchDialog.tsx` | Phase 1b — multi-pair suggestion review dialog (portal, full-screen on mobile) |
| `src/app/(authorized)/cashflow/transactions/_components/transfer/SmartMatchDialogTrigger.tsx` | Renders the "Review similar pairs" action toast/banner after manual link |
| `src/app/(authorized)/settings/transfer-rules/page.tsx` | Phase 2c — Rule management page (Server Component shell) |
| `src/app/(authorized)/settings/transfer-rules/_components/TransferRulesTable.tsx` | Client Component — rule list with toggle, edit inline, delete |
| `src/app/(authorized)/settings/transfer-rules/_components/RuleMatchHistoryDrawer.tsx` | Drawer showing which transactions were auto-linked by a specific rule |
| `src/app/(authorized)/cashflow/transactions/_components/transfer/PostImportMatchBanner.tsx` | Phase 2b — banner shown after CSV import summarising auto-link results |
| `prisma/migrations/{timestamp}_add_transfer_match_rules/migration.sql` | Adds `TransferMatchRule`, `TransferMatchJobResult`; backfills FK on `ImportSession` |

### Files to MODIFY

| File | Change |
|---|---|
| `src/components/transactions/TransactionRow.tsx` | Phase 1a — add Unlink button when `transferLinkedTransactionId` is set |
| `src/app/(authorized)/cashflow/transactions/_components/transfer/TransferLinkDrawer.tsx` | Phase 1b — call `suggestSimilarPairs` after successful link; open `SmartMatchDialog` |
| `src/server/trpc/router/transfer.ts` | Phase 1b — add `suggestSimilarPairs` query and `batchLink` mutation |
| `src/server/trpc/router/index.ts` (or root router) | Register `transferRuleRouter` |
| `prisma/schema.prisma` | Add `TransferMatchRule`, `TransferMatchJobResult` models; add relations to `User` and `ImportSession` |
| `src/app/(authorized)/cashflow/transactions/_components/csv/CSVImportWizard.tsx` (or confirm step) | Phase 2b — call `runTransferMatchRules` after import COMPLETED |
| `src/app/(authorized)/settings/page.tsx` (or nav) | Phase 2c — add "Transfer Rules" link in Settings nav |

### Files to REFERENCE (unchanged)

| File | Why Referenced |
|---|---|
| `src/server/services/transactions/transfer.service.ts` | `scoreCandidate`, `linkTransferPair`, `TRANSFER_DATE_TOLERANCE_DAYS` — reused in rule job |
| `src/server/services/transactions/constants.ts` | `TRANSFER_CATEGORY` constant |
| `src/server/services/transactions/_types.ts` | `TransferCandidateScore` type extended for batch suggestions |
| `src/server/trpc/router/transfer.ts` | Existing `link`, `unlink`, `getCandidates` patterns |
| `src/app/(authorized)/cashflow/transactions/_components/transfer/TransferLinkDrawer.tsx` | Existing candidate UI pattern — Smart Match dialog mirrors its CandidateRow style |
| `src/server/services/transactions/ledger.service.ts` | `rerollupExpenseSummary` — called inside `batchLink` for each confirmed debit |

---

## Verbatim Schema — Relevant Existing Models

```prisma
enum TransactionTypeEnum {
  DEBIT
  CREDIT
}

enum TransactionStatusEnum {
  PENDING
  CONFIRMED
  EXCLUDED
  VOIDED
}

enum ImportStatusEnum {
  PENDING
  PROCESSING
  COMPLETED
  PARTIAL
  FAILED
  VOIDED
}

model Transaction {
  id                          String                 @id @default(cuid())
  date                        DateTime
  description                 String
  amount                      Decimal                @db.Money
  type                        TransactionTypeEnum
  category                    String
  offsetCategory              String?
  offsetTransactionId         String?
  source                      TransactionSourceEnum
  status                      TransactionStatusEnum  @default(PENDING)
  confirmedAt                 DateTime?
  bankAccount                 BankAccount?           @relation(fields: [bankAccountId], references: [id])
  bankAccountId               String?
  user                        User                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId                      String
  importSession               ImportSession?         @relation(fields: [importSessionId], references: [id])
  importSessionId             String?
  offsetTransaction           Transaction?           @relation("ReimbursementLink", fields: [offsetTransactionId], references: [id])
  reimbursements              Transaction[]          @relation("ReimbursementLink")
  transferLinkedTransactionId String?                @unique
  transferLinkedTransaction   Transaction?           @relation("TransferLink", fields: [transferLinkedTransactionId], references: [id])
  transferCounterpart         Transaction?           @relation("TransferLink")
  preLinkCategory             String?
  preLinkStatus               TransactionStatusEnum?
  donationPayment             DonationPayment?
  incomeRecord                IncomeRecord?
  createdAt                   DateTime               @default(now())
  updatedAt                   DateTime               @updatedAt

  @@index([userId, bankAccountId, date])
  @@index([userId, type, status])
  @@index([importSessionId])
}

model ImportSession {
  id                String           @id @default(cuid())
  user              User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId            String
  importType        ImportTypeEnum
  status            ImportStatusEnum @default(PENDING)
  overallConfidence Float?
  recordsCreated    Int              @default(0)
  metadata          Json?
  images            ImportImage[]
  usageLogs         AIUsageLog[]
  transactions      Transaction[]
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  @@index([userId, createdAt])
}

model BankAccount {
  id           String        @id @default(cuid())
  name         String
  bankId       String
  bank         Business      @relation(fields: [bankId], references: [id])
  userId       String
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions Transaction[]
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  @@unique([name, bankId, userId])
}
```

---

## Proposed Schema Additions

```prisma
model TransferMatchRule {
  id                  String    @id @default(cuid())
  userId              String
  user                User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  name                String                 // e.g. "Monthly $2,000 NetBank payback"
  isActive            Boolean   @default(true)

  // Pattern criteria
  amountExact         Decimal?  @db.Money    // exact match; null = use min/max range
  amountMin           Decimal?  @db.Money
  amountMax           Decimal?  @db.Money
  debitKeywords       String[]               // pg array; words extracted from debit description
  creditKeywords      String[]               // words extracted from credit description
  maxDayGap           Int       @default(5)  // max calendar days between DEBIT and CREDIT dates
  debitBankAccountId  String?                // null = any account
  creditBankAccountId String?
  confidenceThreshold Int       @default(85) // score >= threshold → auto-link; else flag for review

  // Stats
  matchCount          Int       @default(0)
  lastMatchedAt       DateTime?

  jobResults          TransferMatchJobResult[]

  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  @@index([userId, isActive])
}

model TransferMatchJobResult {
  id              String             @id @default(cuid())
  userId          String
  importSession   ImportSession      @relation(fields: [importSessionId], references: [id], onDelete: Cascade)
  importSessionId String
  rule            TransferMatchRule? @relation(fields: [ruleId], references: [id], onDelete: SetNull)
  ruleId          String?

  autoLinkedCount Int      @default(0)  // pairs linked automatically (score >= threshold)
  flaggedCount    Int      @default(0)  // pairs suggested for user review (score < threshold)
  skippedCount    Int      @default(0)  // candidates found but not actioned

  reviewedAt      DateTime?             // null = results not yet reviewed by user

  createdAt       DateTime @default(now())

  @@index([userId, importSessionId])
  @@index([ruleId])
}
```

**Additions to existing models:**

```prisma
// User — add relations
transferMatchRules   TransferMatchRule[]
transferMatchJobResults TransferMatchJobResult[]  // optional convenience

// ImportSession — add relation
matchJobResults      TransferMatchJobResult[]
```

---

## Existing Patterns to Reuse

### `scoreCandidate` in `transfer.service.ts`

Already implements the 4-signal scoring model (amount 0–40, date proximity 0–30, description similarity 0–20, same bank bonus 0–10). The rule job reuses this function directly — a rule is simply a persisted set of parameters that narrows the candidate search before scoring.

```typescript
export const TRANSFER_DATE_TOLERANCE_DAYS = 5;
export const TRANSFER_AMOUNT_FEE_TOLERANCE = 10;

export function scoreCandidate(params: {
  sourceAmount: Decimal;
  sourceDate: Date;
  sourceBankId: string | null;
  candidate: { amount: Decimal; date: Date; description: string; bankAccountId: string; bankId: string | null };
  sourceDescription: string;
}): { score: number; breakdown: TransferCandidateScore['scoreBreakdown']; amountDiffWarning: string | null }
```

### `linkTransferPair` in `transfer.service.ts`

The atomic link operation handles rollup reversal and IncomeRecord cleanup. The batch link job calls this function in a loop (not a single transaction) so partial failures are isolated per pair.

### `TransferLinkDrawer.tsx` — CandidateRow pattern

The `SmartMatchDialog` reuses `CandidateRow` visual style. Key: teal border/bg on selection, confidence score coloured green/amber/gray by threshold.

### tRPC Router Pattern

```typescript
import { router, protectedProcedure } from '@/server/trpc/trpc';
// Always use ctx.session.user.id — never trust userId from client input
export const transferRuleRouter = router({
  listRules: protectedProcedure.query(async ({ ctx }) => { ... }),
  createRule: protectedProcedure.input(createRuleSchema).mutation(...),
});
```

---

## Data Flow

### Current: Manual link only

```
User clicks "Link" on DEBIT row
  → TransferLinkDrawer opens (candidates for that one transaction)
  → User selects one candidate → confirm
  → linkTransferPair() called → single pair linked
  → Toast: "Transfer linked"
  → All other similar unmatched pairs remain unlinked ← GAP
```

### Phase 1: Smart Match (reactive, post-link)

```
User confirms manual link
  → linkTransferPair() succeeds
  → transfer.suggestSimilarPairs({ debitId, creditId }) called
  → Service: extract pattern from the confirmed pair
            → find all unmatched Transfer transactions
            → score each candidate against the pattern
            → group into (debit, credit) pairs above threshold ≥ 20
  → SmartMatchDialog opens showing N pairs
  → User selects/deselects pairs → "Match Selected"
  → transfer.batchLink({ pairs }) → N × linkTransferPair()
  → "Optionally save as rule?" prompt
  → User names rule → transferRule.createRule()
```

### Phase 2: Auto-match on CSV upload (proactive)

```
CSV import completes → ImportSession status = COMPLETED
  → runTransferMatchRules({ importSessionId }) called synchronously
  → Load all active TransferMatchRule for the user
  → For each rule:
      - Fetch new transactions from this import with category = TRANSFER_CATEGORY
      - For each new transaction, find unmatched counterpart candidates
      - scoreCandidate() against rule pattern constraints
      - score >= rule.confidenceThreshold → auto-link (linkTransferPair)
      - score 40–threshold → flag for review (write to TransferMatchJobResult)
  → Write TransferMatchJobResult (autoLinkedCount, flaggedCount, skippedCount)
  → PostImportMatchBanner shown on Transactions page
```

---

## Known Constraints & Gotchas

1. **No background job queue** — The app runs on Render.com with no pg-boss/Bull queue. Phase 2b runs the rule job **synchronously** at the end of the import confirmation flow. This is acceptable for typical import sizes (<500 transactions). The spec notes a future upgrade path to pg-boss.

2. **`linkTransferPair` is not idempotent** — It throws if either transaction is already linked. The batch job must pre-filter already-linked transactions before scoring.

3. **Keyword extraction is whitespace/punctuation split** — Same heuristic as `scoreCandidate`. Keywords like "NetBank", "CBA", "AIMEN" are meaningful; stop-words ("to", "from", "the") should be filtered.

4. **`amountExact` vs range** — For exact-match confirmed pairs, always use `amountExact`. `amountMin`/`amountMax` are reserved for rules created manually or where fee tolerance was noted.

5. **`debitBankAccountId` and `creditBankAccountId` may be null** — Rules created from patterns where the user has multiple accounts of the same bank should still match. Null means "any account belonging to the user."

6. **Self-referential rule scoring** — When running rules against a newly imported batch, we must avoid double-matching: if pair (A, B) is matched by rule 1 and rule 2, only the first rule to run gets to link it. Lock by marking the transaction as in-progress or by checking `transferLinkedTransactionId` is still null before each `linkTransferPair` call.
