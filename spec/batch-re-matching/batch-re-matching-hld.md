# High Level Design: Batch Re-matching Expense Categories

> **Version**: 1.0  
> **Date**: 2026-05-12  
> **Status**: Ready for Decision Review  
> **Parent Feature**: [Semantic Category Matching HLD](../semantic-category-matching/semantic-category-matching-hld.md)  
> **Context Mapping**: [Batch Re-matching - Context & Dependencies](./batch-re-matching-context.md)

---

## 1. Problem Statement

### 1.1 Historical Categorization Gap

When a user imports a CSV file from their bank, transactions are categorized using one of two methods:

1. **Phase 1 (Current)**: Embedding-based semantic matching (accurate, AI-powered)
2. **Phase 0 (Legacy)**: Fuzzy/hardcoded matching (error-prone, limited coverage)

Users who imported CSVs before Phase 1 embedding feature was available have historically inaccurate categories. Many transactions default to "Other" because fuzzy matching couldn't understand merchant descriptions like:
- `"CHEMIST WAREHOUSE HORNSBY NS"` → Should be "Healthcare", matches "Other"
- `"WOOLWORTHS 1294 HORNSBY NS"` → Should be "Food", matches "Other"
- `"TRANSPORTFORNSW TAP SYDNEY"` → Should be "Transportation", matches "Other"

### 1.2 Business Need

Provide admins and power users with a tool to **systematically recategorize historical imports** using the new embedding-based system, improving data quality without requiring users to manually re-import.

---

## 2. Goals

| # | Goal | Audience |
|---|------|----------|
| G1 | Enable bulk recategorization of historical imports with embedding-based system | Admin |
| G2 | Provide before/after comparison to validate accuracy improvements | Admin/User |
| G3 | Track cost of batch re-matching (embedding API tokens) | Finance |
| G4 | Allow filtering by category, date range, or import session | Admin/User |
| G5 | Implement dry-run preview to prevent accidental overwrites | User |
| G6 | Gracefully handle partial failures (1 failed record doesn't block batch) | System |
| G7 | Support scaling to 10k+ records (via async job queue in Phase 2) | System |
| G8 | Maintain audit trail of all changes (before/after per record) | Compliance |

---

## 3. Non-Goals (Out of Scope)

- **Automatic re-matching**: Only manual admin trigger (no scheduled jobs in Phase 1)
- **User-facing UI** (Phase 1): Admin API only; UI dashboard in Phase 2
- **Real-time streaming**: Sync processing acceptable for Phase 1
- **Machine learning retraining**: Uses existing embedding model
- **Multi-language support**: English expense categories only
- **Rollback** (Phase 1): Audit trail tracks changes; rollback deferred to Phase 2

---

## 4. Architecture Overview

### 4.1 Two-Phase Approach

**Phase 1 (Sync Batch)**:
- Synchronous batch processing (API blocks until done)
- Acceptable for up to 5000 records (~5 min max)
- Simple implementation: no job queue required
- Dry-run preview mode for safety
- Audit trail logging

**Phase 2 (Async + UI)**:
- Background job queue (Bull/BullMQ)
- Real-time progress tracking via SSE or WebSocket
- Admin dashboard UI for visualization
- Batch scheduling (e.g., nightly recategorization)
- Rollback capability

### 4.2 Processing Pipeline

```
┌─────────────────────────────────────────────────────────┐
│                  Admin Initiates Batch                  │
│  POST /api/admin/expenses/re-match-categories          │
│  {filter: {category: "Other", ...}, options: {...}}    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │  1. Validate Request       │
        │  ├─ Auth check (admin-only)│
        │  ├─ Validate filter        │
        │  └─ Check size limits      │
        └────────────────┬───────────┘
                         │
                         ▼
        ┌────────────────────────────┐
        │  2. Query Expense Entries  │
        │  ├─ WHERE category = 'Other'
        │  ├─ AND createdAt > date   │
        │  └─ LIMIT 5000             │
        └────────────────┬───────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │  3. For Each Entry (rate-limited)  │
        │  ├─ Extract merchant description  │
        │  ├─ Call embedding matcher        │
        │  │  └─ findBestCategoryMatch()    │
        │  ├─ Compare old vs new category   │
        │  └─ Collect result (success/fail) │
        └────────────────┬───────────────────┘
                         │
                         ▼
        ┌──────────────────────────────┐
        │  4. Dry-Run Preview (If Set) │
        │  ├─ Return what would change │
        │  └─ Don't commit to DB       │
        └────────────────┬─────────────┘
                         │
           ┌─────────────┴──────────────┐
           │                            │
    dryRun=true              dryRun=false (default)
           │                            │
           └──────────┬─────────────────┴──────┐
                      │                        │
                      ▼                        ▼
           ┌──────────────────┐    ┌────────────────────┐
           │  Return Preview  │    │  Bulk Update DB    │
           │  (no commit)     │    │  ├─ Update Expense │
           │                  │    │  │   Entry.category│
           │                  │    │  ├─ Log to        │
           │                  │    │  │   AIUsageLog    │
           │                  │    │  └─ Log to        │
           │                  │    │     BatchReMatch   │
           │                  │    │     Job           │
           └──────────────────┘    └────────────────────┘
                      │                        │
           Return     │                        │  Return
           Preview    └────────────┬───────────┘  Final
                                   │              Result
                                   ▼
                    ┌──────────────────────────┐
                    │  Return Batch Result     │
                    │  ├─ jobId                │
                    │  ├─ changesSummary       │
                    │  ├─ tokensUsed           │
                    │  ├─ costUSD              │
                    │  └─ completedAt          │
                    └──────────────────────────┘
```

### 4.3 Integration with Semantic Category Matching

```
Semantic Category Matching (Phase 1)
├─ embedding.service.ts
│  └─ findBestCategoryMatch(text) → {category, similarity}
│
└─ category-matcher.service.ts
   └─ matchCategoryWithSemantics(text) → category

Batch Re-matching (Phase 2, depends on Phase 1)
├─ batch-matcher.service.ts
│  ├─ filterExpenseEntries(filter) → [ExpenseEntry]
│  ├─ matchAndCompare(entries) → [{old, new, similarity}]
│  └─ prepareChangeset(entries) → {summary, updates}
│
├─ batch-job.service.ts
│  ├─ startBatchReMatch(filter) → jobId
│  ├─ processBatch(jobId) → progress tracking
│  └─ getBatchResult(jobId) → final summary
│
└─ POST /api/admin/expenses/re-match-categories
   └─ HTTP entry point
      └─ Calls batch-job.service.startBatchReMatch()
```

---

## 5. Key Algorithms

### 5.1 Filtering Algorithm

**Input**: BatchReMatchFilter (category, dateRange, importSessionId, etc.)

**Output**: List of ExpenseEntry records matching criteria

**Logic**:
```typescript
WHERE
  category = filter.category (OR all if null)
  AND createdAt BETWEEN filter.createdAfter AND filter.createdBefore
  AND (
    importSessionId = filter.importSessionId (if specified)
    OR any importSessionId (if null)
  )
  AND deletedAt IS NULL
LIMIT filter.maxBatchSize (default 5000)
ORDER BY createdAt DESC
```

### 5.2 Matching Algorithm

**Input**: ExpenseEntry with merchant description

**Output**: New category + similarity score

**Logic**:
```
1. Extract merchantDescription from Expense
2. Call findBestCategoryMatch(merchantDescription)
3. If similarity >= 0.75 → Use new category
4. If similarity < 0.75 → Keep old category (skip)
5. If embedding API fails → Use fuzzy match fallback
```

### 5.3 Changeset Aggregation

**Input**: List of {entryId, oldCategory, newCategory, similarity}

**Output**: Changeset summary for reporting

**Logic**:
```typescript
changesSummary = {
  [oldCategory]: {
    [newCategory]: count,
    ...
  },
  ...
}

Example:
{
  "other": {
    "food": 85,
    "utilities": 24,
    "shopping": 11
  },
  "misc": {
    "entertainment": 2
  }
}
```

---

## 6. Data Model

### 6.1 New Prisma Model: BatchReMatchJob

```prisma
model BatchReMatchJob {
  id String @id @default(cuid())
  status String // PENDING, IN_PROGRESS, COMPLETED, FAILED, CANCELLED
  userId String // Admin who triggered
  filter Json // Serialized filter (category, dateRange, etc.)
  options Json // Serialized options (dryRun, maxBatchSize, etc.)
  
  totalRecords Int
  processedCount Int @default(0)
  successCount Int @default(0)
  failureCount Int @default(0)
  skippedCount Int @default(0)
  
  changesSummary Json // Aggregated {oldCat → newCat → count}
  embeddingTokensUsed Int @default(0)
  estimatedCostUSD Decimal @default(0)
  errors Json // Array of {entryId, reason, timestamp}
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  completedAt DateTime?
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId, status])
  @@index([status, createdAt])
}
```

---

## 7. API Contract

### 7.1 Start Batch Re-matching

```http
POST /api/admin/expenses/re-match-categories
Content-Type: application/json

{
  "filter": {
    "category": "other",           // Optional: specific category
    "importSessionId": "sess_123",  // Optional: specific import
    "createdAfter": "2024-01-01",   // Optional: date range
    "createdBefore": "2025-01-01",
    "minSimilarityThreshold": 0.75  // Only recategorize if new match > this
  },
  "options": {
    "dryRun": false,                // Default: false
    "maxBatchSize": 5000,           // Default: 5000
    "throttleRatePerSecond": 5      // Default: 5
  }
}

Response (200 OK):
{
  "jobId": "batch_clh7k9x2p0000qz0h0w0w0w0w",
  "status": "IN_PROGRESS",
  "totalRecords": 247,
  "startedAt": "2026-05-12T21:15:00Z"
}
```

### 7.2 Get Batch Status

```http
GET /api/admin/expenses/re-match-categories/batch_clh7k9x2p0000qz0h0w0w0w0w

Response (200 OK):
{
  "jobId": "batch_clh7k9x2p0000qz0h0w0w0w0w",
  "status": "COMPLETED",
  "totalRecords": 247,
  "processedCount": 247,
  "successCount": 198,
  "failureCount": 12,
  "skippedCount": 37,
  "progress": 100,
  "changesSummary": {
    "other": {
      "food": 85,
      "groceries": 78,
      "utilities": 24
    }
  },
  "embeddingTokensUsed": 24710,
  "estimatedCostUSD": 0.494,
  "completedAt": "2026-05-12T21:18:00Z"
}
```

---

## 8. Performance Characteristics

| Metric | Target | Notes |
|--------|--------|-------|
| **Batch size** | 1000–5000 records | Phase 1: sync max; Phase 2: async unlimited |
| **Processing time** | ~200ms per record | Dominated by embedding API latency |
| **1000 records** | ~3–5 minutes | 5 calls/sec rate limit |
| **API timeout** | 30 seconds per request | Phase 1: whole batch; Phase 2: long-polling |
| **Cost per 1000** | ~$0.49 | Based on 10k embedding tokens @ $0.02/1M |

---

## 9. Error Handling Strategy

### 9.1 Graceful Partial Failure

- If one record fails: Log error, continue with next record
- If embedding API fails for one call: Use Levenshtein fallback
- If database update fails: Log error, skip record, continue
- Final report: Shows success/failure/skipped counts

### 9.2 Retry Logic

- Transient failures (timeout, rate limit): Retry up to 3 times
- Permanent failures (validation error): Skip record, log reason
- API failures: Fall back to Levenshtein fuzzy matching

### 9.3 Timeout Handling

- Phase 1 (Sync): 5-minute timeout for whole batch
- Phase 2 (Async): No timeout; job persists until completion

---

## 10. Security & Authorization

### 10.1 Permission Model (Phase 1)

- **Admin-only**: Only users with admin role can trigger
- **Own data only**: Can only recategorize own expenses (via userId filter)

### 10.2 Phase 2 Enhancements

- RBAC: Different roles (admin, accountant, user)
- Audit logging: All changes logged with actor, timestamp, reason

---

## 11. Success Metrics

- ✅ Batch process 1000 records in <5 minutes
- ✅ >70% of "Other" category correctly recategorized
- ✅ Zero data loss or accidental overwrites
- ✅ Cost tracking accurate (token count + USD)
- ✅ Dry-run preview matches actual results
- ✅ Error messages clear and actionable

---

## 12. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| API timeout on large batches | High | Phase 1: Max 5000 records; Phase 2: async |
| Accidental data overwrite | High | Dry-run mandatory review |
| Cost explosion | Medium | Cost estimate before commit; alert on >5000 |
| Rate limiting | Medium | Throttle to 5 calls/sec; retry logic |
| Partial failure | Low | Continue on single failure; audit trail |

---

## 13. Next Steps

1. **Resolve Assumptions** (context.md Section 4) with stakeholders
2. **Create LLD** with detailed implementation specs
3. **Implement TDD**: Write tests first, then services
4. **Phase 1 Deployment**: Sync batch processing
5. **Phase 2 Planning**: Async job queue + UI dashboard
