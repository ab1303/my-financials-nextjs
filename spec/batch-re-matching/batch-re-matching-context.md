# Batch Re-matching - Implementation Context & Dependencies

> **Created**: 2026-05-12  
> **Phase**: Phase 2 (Post Semantic Category Matching Phase 1)  
> **Related Specs**: [Semantic Category Matching Context](../semantic-category-matching/semantic-category-matching-context.md)  
> **Status**: Pre-implementation planning

---

## 1. Feature Overview

**Batch Re-matching** enables admins to systematically recategorize historical expense records using the new embedding-based semantic category matching system. This allows users to improve categorization of older imports that were created before embeddings were available (when fuzzy/hardcoded matching was used).

### Key Characteristics

- **Scope**: Bulk update of ExpenseEntry.category field based on merchant descriptions
- **Trigger**: Manual admin action (no automatic re-matching)
- **Filter Options**: By category, import session, date range, similarity threshold
- **Progress Model**: Real-time progress tracking
- **Audit Trail**: Before/after comparison with full change log
- **Cost Tracking**: Token usage logged to AIUsageLog

---

## 2. Files to Create/Modify

### 2.1 New Service Files

#### `src/server/services/batch-re-matching/batch-matcher.service.ts` (NEW)
- **Role**: Core batch processing logic
- **Exports**:
  - `filterExpenseEntries(filter: BatchReMatchFilter)` — Query builder based on filter options
  - `matchAndCompare(entries, options)` — Process entries, compare old vs new categories
  - `prepareChangeset(entries, newMatches)` — Build atomic bulk update with validation
- **Dependencies**:
  - `embedding.service.ts` (from semantic-category-matching Phase 1)
  - `category-matcher.service.ts` (from Phase 1)
  - Prisma: ExpenseEntry, Expense, AIImportSession, ExpenseCategory

---

#### `src/server/services/batch-re-matching/batch-job.service.ts` (NEW)
- **Role**: Job orchestration, progress tracking, error handling
- **Exports**:
  - `startBatchReMatch(filter, options)` — Initiate batch, return jobId
  - `getBatchStatus(jobId)` — Real-time progress + stats
  - `cancelBatchJob(jobId)` — Stop mid-execution (if async)
  - `getBatchResult(jobId)` — Final changeset after completion
- **Concerns**:
  - Rate limiting: Throttle embedding API calls (e.g., 5 req/sec)
  - Partial failure handling: Continue on single entry failure
  - Concurrency: Prevent simultaneous batch runs on same filter

---

### 2.2 API Route Files

#### `src/app/api/admin/expenses/re-match-categories/route.ts` (NEW)
- **Role**: Entry point for batch re-matching
- **Methods**:
  - `POST` — Start new batch job with filter + options
  - `GET` — List recent batch jobs + their status
- **Request Body**:
  ```typescript
  {
    filter: {
      category?: string; // Limit to specific category
      importSessionId?: string; // Limit to specific CSV import
      createdBefore?: ISO8601; // Older than date
      createdAfter?: ISO8601;
      minSimilarityThreshold?: number; // Only recategorize if new match > this
    };
    options: {
      dryRun?: boolean; // Preview changes without committing
      maxBatchSize?: number; // Safety limit
      throttleRatePerSecond?: number; // Rate limit for API calls
    };
  }
  ```

#### `src/app/api/admin/expenses/re-match-categories/[jobId]/route.ts` (NEW)
- **Role**: Check status and retrieve results
- **Methods**:
  - `GET` — Fetch batch status, progress, results
  - `DELETE` — Cancel running batch

---

### 2.3 Database & Types

#### `src/server/services/batch-re-matching/_types.ts` (NEW)
```typescript
interface BatchReMatchFilter {
  category?: string;
  importSessionId?: string;
  createdBefore?: Date;
  createdAfter?: Date;
  minSimilarityThreshold?: number;
}

interface BatchReMatchOptions {
  dryRun?: boolean;
  maxBatchSize?: number;
  throttleRatePerSecond?: number;
}

interface BatchReMatchJob {
  jobId: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  totalRecords: number;
  processedCount: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  progress: number; // 0-100
  changesSummary: Record<string, Record<string, number>>; // oldCat → newCat → count
  embeddingTokensUsed: number;
  estimatedCostUSD: number;
  startedAt: Date;
  completedAt?: Date;
  errors: Array<{entryId: string; reason: string}>;
}
```

#### Prisma Schema Update (NEW)
```prisma
model BatchReMatchJob {
  id String @id @default(cuid())
  status String // PENDING, IN_PROGRESS, COMPLETED, FAILED, CANCELLED
  userId String
  filter Json // Serialized BatchReMatchFilter
  options Json // Serialized BatchReMatchOptions
  totalRecords Int
  processedCount Int @default(0)
  successCount Int @default(0)
  failureCount Int @default(0)
  skippedCount Int @default(0)
  changesSummary Json // Nested category change map
  embeddingTokensUsed Int @default(0)
  estimatedCostUSD Decimal @default(0)
  errors Json // Array of {entryId, reason}
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  completedAt DateTime?
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId, status])
  @@index([createdAt])
}
```

---

## 3. System Integration Map

### 3.1 Data Flow

```
POST /api/admin/expenses/re-match-categories
       │
       ├─ Auth check (admin-only)
       ├─ Validate filter + options
       └─ Call batch-job.service.startBatchReMatch()
              │
              ├─ Query ExpenseEntry based on filter
              │  (e.g., WHERE category = 'Other' AND createdAt > date)
              │
              ├─ For each entry (rate-limited):
              │  ├─ Extract merchant description from Expense
              │  ├─ Call findBestCategoryMatch() [Phase 1 embedding service]
              │  ├─ Compare oldCategory vs newCategory
              │  ├─ Check minSimilarityThreshold
              │  └─ Collect result
              │
              ├─ Aggregate changeset (oldCat → newCat → count)
              ├─ Calculate total tokens + cost
              │
              ├─ If dryRun=true: Return preview only
              ├─ If dryRun=false: Bulk update ExpenseEntry + AIUsageLog
              │
              └─ Store result in BatchReMatchJob table
```

### 3.2 Dependency on Phase 1

```
Phase 1: Semantic Category Matching
├─ embedding.service.ts
│  └─ findBestCategoryMatch(text, categories)
│
└─ category-matcher.service.ts
   └─ matchCategoryWithSemantics(text)

Phase 2: Batch Re-matching (Depends on Phase 1)
├─ batch-matcher.service.ts
│  └─ Calls findBestCategoryMatch() for each ExpenseEntry
│
├─ batch-job.service.ts
│  └─ Orchestrates, rate-limits, tracks progress
│
└─ POST /api/admin/expenses/re-match-categories
   └─ HTTP entry point, auth + validation
```

---

## 4. Unresolved Assumptions

### 4.1 Sync vs Async Execution

**Decision Required**: Should batch processing block API call or run asynchronously?

| Option | Trade-offs |
|--------|-----------|
| **Sync (V1)** | Simpler code, acceptable for <1000 records, API blocks for up to 5 min |
| **Async (V2)** | Complex job queue (Bull/BullMQ), better UX, handles 10k+ records |

**Recommendation**: Start with Sync for Phase 2 V1; defer async to V2 if needed

---

### 4.2 Rate Limiting & Batch Size

**Decision Required**: What limits should we enforce?

| Limit | Proposed | Rationale |
|-------|----------|-----------|
| **Max records/batch** | 5000 | Safety limit, prevents API timeouts |
| **Embedding API rate** | 5 calls/sec | Conservative, avoids GitHub Models rate limits |
| **DB write batching** | 100 records/commit | Partial failure recovery |

---

### 4.3 Dry-Run Preview Mode

**Decision Required**: Should users preview changes before committing?

- **Yes** (Recommended): User-friendly, prevents accidental overwrites
- **No**: Simpler code path

---

### 4.4 Rollback Capability

**Decision Required**: Can users undo a batch re-match?

| Option | Trade-offs |
|--------|-----------|
| **Rollback endpoint** | Allows undo, requires storing old categories, complex |
| **Audit trail only** | No automatic undo, requires manual review, simpler |

**Recommendation**: Audit trail (Phase 1) + rollback (Phase 2, if needed)

---

### 4.5 Permission Model

**Decision Required**: Who can trigger batch re-matching?

- **Admin-only** (Recommended Phase 1): Strictest, simplest
- **RBAC with roles** (Phase 2): Granular control

---

### 4.6 Duplicate Prevention

**Decision Required**: Prevent accidental double-execution of same batch?

**Recommended**: Job locking (mark filter as in-progress, reject duplicates)

---

### 4.7 Metrics & Reporting

**Decision Required**: What should final report include?

**Proposed Results**:
```json
{
  "totalRecords": 247,
  "successCount": 198,
  "failureCount": 12,
  "skippedCount": 37,
  "changesSummary": {
    "other": {"food": 85, "utilities": 24},
    "misc": {"entertainment": 2}
  },
  "accuracyImprovement": "75% of 'Other' recategorized",
  "embeddingTokensUsed": 24710,
  "estimatedCostUSD": 0.494
}
```

---

### 4.8 Cancellation

**Decision Required**: Can user cancel in-progress batch?

- **Yes** (Recommended): Graceful shutdown, commit processed records
- **No**: Must let batch complete

---

## 5. Implementation Dependency Graph

### Sequential Order

```
1. Semantic Category Matching Phase 1
   └─ Must complete before batch re-matching can start

2. BatchReMatchJob Prisma model
   └─ Schema definition

3. batch-matcher.service.ts
   └─ Core batch logic (TDD)

4. batch-job.service.ts
   └─ Orchestration (TDD)

5. API routes
   └─ HTTP entry points

6. Integration tests
   └─ End-to-end verification

7. Phase 2: Async job queue + UI dashboard
```

---

## 6. Risk & Mitigation

| Risk | Mitigation |
|------|-----------|
| **API timeout on large batches** | V1: Max 5000 records; V2: Async job queue |
| **Rate limiting from embedding API** | Throttle to 5 calls/sec |
| **Database lock contention** | Batch commits every 100 records |
| **Cost explosion** | Dry-run preview + cost estimate before commit |
| **Accidental data loss** | Audit trail + optional rollback (Phase 2) |
| **Duplicate runs** | Job locking per filter |
| **Permission bypass** | Auth check + RBAC on route |

---

## 7. Success Metrics

- [ ] Batch process 1000 records in <5 minutes (sync Phase 1)
- [ ] Dry-run preview accurate
- [ ] Cost tracking precise (tokens + USD)
- [ ] Accuracy improvement >70% for "Other" category
- [ ] Zero accidental overwrites

---

## 8. File Checklist (Phase 1)

- [ ] `src/server/services/batch-re-matching/batch-matcher.service.ts` — **NEW**
- [ ] `src/server/services/batch-re-matching/batch-job.service.ts` — **NEW**
- [ ] `src/server/services/batch-re-matching/_types.ts` — **NEW**
- [ ] `src/app/api/admin/expenses/re-match-categories/route.ts` — **NEW**
- [ ] `src/app/api/admin/expenses/re-match-categories/[jobId]/route.ts` — **NEW**
- [ ] `prisma/schema.prisma` — **ADD** BatchReMatchJob model
- [ ] `src/__tests__/unit/batch-matcher.service.test.ts` — **NEW (TDD)**
- [ ] `src/__tests__/integration/batch-re-matching.integration.test.ts` — **NEW (TDD)**

---

## 9. Next Steps

1. **Resolve Assumptions** (Sections 4.1–4.8) before Phase 2 kickoff
2. **Create HLD** — High-level architecture
3. **Create LLD** — Detailed implementation specs
4. Implement using TDD
