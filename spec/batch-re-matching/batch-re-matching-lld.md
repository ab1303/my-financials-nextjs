# Low Level Design: Batch Re-matching Expense Categories

> **Version**: 1.0  
> **Date**: 2026-05-12  
> **Status**: Ready for Decision Review  
> **Parent**: [Batch Re-matching HLD](./batch-re-matching-hld.md)  
> **Context Mapping**: [Batch Re-matching - Context & Dependencies](./batch-re-matching-context.md)

---

## 1. Service: batch-matcher.service.ts

### 1.1 Filtering Service

**Function**: `filterExpenseEntries(filter: BatchReMatchFilter)`

```typescript
interface BatchReMatchFilter {
  category?: string;
  importSessionId?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  minSimilarityThreshold?: number;
}

async function filterExpenseEntries(
  filter: BatchReMatchFilter,
  maxResults: number = 5000
): Promise<Array<{id: string; category: string; merchantDescription: string}>> {
  const where = {
    deletedAt: null,
    ...(filter.category && {category: filter.category}),
    ...(filter.createdAfter && {createdAt: {gte: filter.createdAfter}}),
    ...(filter.createdBefore && {createdAt: {lte: filter.createdBefore}}),
  };
  
  const expenseEntries = await prisma.expenseEntry.findMany({
    where,
    select: {id: true, category: true, expense: {select: {merchantDescription: true}}},
    take: maxResults,
    orderBy: {createdAt: 'desc'},
  });
  
  return expenseEntries.map(e => ({
    id: e.id,
    category: e.category,
    merchantDescription: e.expense.merchantDescription,
  }));
}
```

**Error Handling**:
- If no records match: Return empty array (log as warning)
- If filter validation fails: Throw ValidationError

---

### 1.2 Matching Service

**Function**: `matchAndCompare(entries, options)`

```typescript
interface MatchResult {
  entryId: string;
  oldCategory: string;
  newCategory: string | null;
  similarity: number;
  action: 'updated' | 'skipped' | 'error';
  reason?: string;
}

async function matchAndCompare(
  entries: Array<{id: string; category: string; merchantDescription: string}>,
  options: {
    minSimilarityThreshold: number;
    throttleRatePerSecond: number;
  }
): Promise<MatchResult[]> {
  const results: MatchResult[] = [];
  const rateLimit = 1000 / options.throttleRatePerSecond; // ms between calls
  
  for (const entry of entries) {
    try {
      // Rate limiting
      await sleep(rateLimit);
      
      // Call embedding matcher
      const match = await findBestCategoryMatch(
        entry.merchantDescription,
        {retries: 3} // 3 retries with exponential backoff
      );
      
      if (!match) {
        results.push({
          entryId: entry.id,
          oldCategory: entry.category,
          newCategory: null,
          similarity: 0,
          action: 'skipped',
          reason: 'No match found; using fuzzy match would keep old category',
        });
        continue;
      }
      
      // Check threshold
      if (match.similarity < options.minSimilarityThreshold) {
        results.push({
          entryId: entry.id,
          oldCategory: entry.category,
          newCategory: null,
          similarity: match.similarity,
          action: 'skipped',
          reason: `Similarity ${match.similarity.toFixed(2)} < threshold ${options.minSimilarityThreshold}`,
        });
        continue;
      }
      
      // Valid match
      results.push({
        entryId: entry.id,
        oldCategory: entry.category,
        newCategory: match.category,
        similarity: match.similarity,
        action: 'updated',
      });
    } catch (error) {
      results.push({
        entryId: entry.id,
        oldCategory: entry.category,
        newCategory: null,
        similarity: 0,
        action: 'error',
        reason: error.message,
      });
    }
  }
  
  return results;
}
```

---

### 1.3 Changeset Aggregation

**Function**: `aggregateChangeset(results)`

```typescript
interface ChangesetSummary {
  [oldCategory: string]: {
    [newCategory: string]: number;
  };
}

function aggregateChangeset(results: MatchResult[]): ChangesetSummary {
  const summary: ChangesetSummary = {};
  
  for (const result of results) {
    if (result.action === 'updated' && result.newCategory) {
      if (!summary[result.oldCategory]) {
        summary[result.oldCategory] = {};
      }
      summary[result.oldCategory][result.newCategory] = 
        (summary[result.oldCategory][result.newCategory] || 0) + 1;
    }
  }
  
  return summary;
}
```

---

## 2. Service: batch-job.service.ts

### 2.1 Job Initialization

**Function**: `startBatchReMatch(filter, options)`

```typescript
async function startBatchReMatch(
  userId: string,
  filter: BatchReMatchFilter,
  options: BatchReMatchOptions
): Promise<{jobId: string; totalRecords: number}> {
  // Validate auth (admin-only)
  const user = await prisma.user.findUniqueOrThrow({where: {id: userId}});
  if (!user.isAdmin) throw new UnauthorizedError('Admin required');
  
  // Check for duplicate in-progress batch (prevent double-execution)
  const existing = await prisma.batchReMatchJob.findFirst({
    where: {
      userId,
      status: {in: ['PENDING', 'IN_PROGRESS']},
      filter: filter, // JSON equality
    },
  });
  if (existing) throw new ConflictError(`Batch ${existing.id} already in progress`);
  
  // Query total records to process
  const entries = await filterExpenseEntries(filter, 999999); // No limit for count
  const totalRecords = entries.length;
  
  if (totalRecords === 0) {
    throw new ValidationError('No records match filter');
  }
  
  if (totalRecords > options.maxBatchSize) {
    throw new ValidationError(
      `Batch size ${totalRecords} exceeds limit ${options.maxBatchSize}`
    );
  }
  
  // Create job record
  const job = await prisma.batchReMatchJob.create({
    data: {
      userId,
      status: 'PENDING',
      filter,
      options,
      totalRecords,
    },
  });
  
  // Start processing async (fire-and-forget for Phase 1)
  processBatchAsync(job.id).catch(err => {
    console.error(`Batch ${job.id} failed:`, err);
    // Log to Sentry/monitoring
  });
  
  return {jobId: job.id, totalRecords};
}
```

### 2.2 Job Processing

**Function**: `processBatchAsync(jobId)`

```typescript
async function processBatchAsync(jobId: string): Promise<void> {
  const job = await prisma.batchReMatchJob.findUniqueOrThrow({
    where: {id: jobId},
  });
  
  try {
    // Update status
    await prisma.batchReMatchJob.update({
      where: {id: jobId},
      data: {status: 'IN_PROGRESS', updatedAt: new Date()},
    });
    
    // Fetch entries to process
    const filter = job.filter as BatchReMatchFilter;
    const entries = await filterExpenseEntries(filter, job.totalRecords);
    
    // Match and compare
    const options = job.options as BatchReMatchOptions;
    const results = await matchAndCompare(entries, {
      minSimilarityThreshold: 0.75, // From Phase 1 decision
      throttleRatePerSecond: options.throttleRatePerSecond || 5,
    });
    
    // Aggregate changes
    const changesSummary = aggregateChangeset(results);
    
    // Calculate tokens and cost
    const embeddingTokensUsed = results.filter(r => r.action !== 'error').length * 100; // Estimate
    const estimatedCostUSD = (embeddingTokensUsed / 1_000_000) * 0.02;
    
    // Dry-run: return without committing
    if (options.dryRun) {
      await prisma.batchReMatchJob.update({
        where: {id: jobId},
        data: {
          status: 'COMPLETED',
          processedCount: results.length,
          successCount: results.filter(r => r.action === 'updated').length,
          failureCount: results.filter(r => r.action === 'error').length,
          skippedCount: results.filter(r => r.action === 'skipped').length,
          changesSummary,
          embeddingTokensUsed,
          estimatedCostUSD,
          completedAt: new Date(),
        },
      });
      return;
    }
    
    // Bulk update database
    const updates = results
      .filter(r => r.action === 'updated' && r.newCategory)
      .map(r => ({id: r.entryId, newCategory: r.newCategory!}));
    
    for (const update of updates) {
      await prisma.expenseEntry.update({
        where: {id: update.id},
        data: {category: update.newCategory},
      });
    }
    
    // Log token usage
    await prisma.aIUsageLog.create({
      data: {
        userId: job.userId,
        importType: 'EXPENSE',
        promptTokens: embeddingTokensUsed,
        completionTokens: 0,
        totalTokens: embeddingTokensUsed,
        estimatedCostUSD,
        metadata: {batchJobId: jobId},
      },
    });
    
    // Update job as completed
    await prisma.batchReMatchJob.update({
      where: {id: jobId},
      data: {
        status: 'COMPLETED',
        processedCount: results.length,
        successCount: results.filter(r => r.action === 'updated').length,
        failureCount: results.filter(r => r.action === 'error').length,
        skippedCount: results.filter(r => r.action === 'skipped').length,
        changesSummary,
        embeddingTokensUsed,
        estimatedCostUSD,
        errors: results.filter(r => r.action === 'error'),
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    await prisma.batchReMatchJob.update({
      where: {id: jobId},
      data: {
        status: 'FAILED',
        errors: [{error: error.message, timestamp: new Date()}],
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });
    throw error;
  }
}
```

### 2.3 Job Status Retrieval

**Function**: `getBatchStatus(jobId)`

```typescript
async function getBatchStatus(jobId: string) {
  const job = await prisma.batchReMatchJob.findUniqueOrThrow({
    where: {id: jobId},
  });
  
  const progress = job.totalRecords > 0 
    ? Math.floor((job.processedCount / job.totalRecords) * 100) 
    : 0;
  
  return {
    jobId: job.id,
    status: job.status,
    totalRecords: job.totalRecords,
    processedCount: job.processedCount,
    successCount: job.successCount,
    failureCount: job.failureCount,
    skippedCount: job.skippedCount,
    progress,
    changesSummary: job.changesSummary,
    embeddingTokensUsed: job.embeddingTokensUsed,
    estimatedCostUSD: job.estimatedCostUSD.toNumber(),
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  };
}
```

---

## 3. API Route: route.ts

### 3.1 POST - Start Batch

```typescript
// src/app/api/admin/expenses/re-match-categories/route.ts

import {auth} from '@/server/auth';
import {batchJobService} from '@/server/services/batch-re-matching/batch-job.service';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', {status: 401});
  }
  
  const {filter, options} = await req.json();
  
  try {
    const {jobId, totalRecords} = await batchJobService.startBatchReMatch(
      session.user.id,
      filter,
      options ?? {}
    );
    
    return Response.json({
      jobId,
      status: 'PENDING',
      totalRecords,
      startedAt: new Date(),
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json({error: error.message}, {status: 400});
    }
    if (error instanceof UnauthorizedError) {
      return Response.json({error: error.message}, {status: 403});
    }
    return Response.json({error: 'Internal server error'}, {status: 500});
  }
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', {status: 401});
  }
  
  // List recent jobs for this user
  const jobs = await prisma.batchReMatchJob.findMany({
    where: {userId: session.user.id},
    orderBy: {createdAt: 'desc'},
    take: 10,
  });
  
  return Response.json({jobs});
}
```

### 3.2 GET/DELETE - Job Status & Cancellation

```typescript
// src/app/api/admin/expenses/re-match-categories/[jobId]/route.ts

export async function GET(req: Request, {params}: {params: {jobId: string}}) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', {status: 401});
  }
  
  const job = await prisma.batchReMatchJob.findUnique({
    where: {id: params.jobId},
  });
  
  if (!job) {
    return Response.json({error: 'Not found'}, {status: 404});
  }
  
  // Authorization: only owner or admin can view
  if (job.userId !== session.user.id && !session.user.isAdmin) {
    return Response.json({error: 'Forbidden'}, {status: 403});
  }
  
  const status = await batchJobService.getBatchStatus(params.jobId);
  return Response.json(status);
}

export async function DELETE(req: Request, {params}: {params: {jobId: string}}) {
  const session = await auth();
  if (!session?.user?.id || !session.user.isAdmin) {
    return new Response('Unauthorized', {status: 401});
  }
  
  // Mark as cancelled (Phase 1: simple; Phase 2: graceful shutdown)
  await prisma.batchReMatchJob.update({
    where: {id: params.jobId},
    data: {status: 'CANCELLED', completedAt: new Date()},
  });
  
  return Response.json({message: 'Batch cancelled'});
}
```

---

## 4. Type Definitions

**File**: `src/server/services/batch-re-matching/_types.ts`

```typescript
export interface BatchReMatchFilter {
  category?: string;
  importSessionId?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  minSimilarityThreshold?: number;
}

export interface BatchReMatchOptions {
  dryRun?: boolean;
  maxBatchSize?: number;
  throttleRatePerSecond?: number;
}

export interface BatchReMatchJobResult {
  jobId: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  totalRecords: number;
  processedCount: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  progress: number;
  changesSummary: Record<string, Record<string, number>>;
  embeddingTokensUsed: number;
  estimatedCostUSD: number;
  createdAt: Date;
  completedAt?: Date;
}

export interface MatchResult {
  entryId: string;
  oldCategory: string;
  newCategory: string | null;
  similarity: number;
  action: 'updated' | 'skipped' | 'error';
  reason?: string;
}
```

---

## 5. Testing Strategy

### 5.1 Unit Tests (batch-matcher.service.test.ts)

```typescript
describe('filterExpenseEntries', () => {
  it('should filter by category', async () => {
    // Setup: Create test data
    // Call filterExpenseEntries({category: 'other'})
    // Assert: Only 'other' entries returned
  });

  it('should filter by date range', async () => {
    // Setup: Create test data with various dates
    // Call filterExpenseEntries({createdAfter, createdBefore})
    // Assert: Only entries in range returned
  });
});

describe('matchAndCompare', () => {
  it('should update category if similarity >= threshold', async () => {
    // Mock findBestCategoryMatch to return {category: 'food', similarity: 0.85}
    // Call matchAndCompare([...])
    // Assert: action = 'updated'
  });

  it('should skip if similarity < threshold', async () => {
    // Mock embedding to return {category: 'food', similarity: 0.65}
    // Call matchAndCompare({minSimilarityThreshold: 0.75})
    // Assert: action = 'skipped'
  });

  it('should handle API errors gracefully', async () => {
    // Mock embedding to throw error
    // Call matchAndCompare([...])
    // Assert: action = 'error', continue with next entry
  });
});

describe('aggregateChangeset', () => {
  it('should count changes by old→new category', async () => {
    // Setup: Mock results with multiple changes
    // Call aggregateChangeset([...])
    // Assert: {other: {food: 5, utilities: 3}}
  });
});
```

### 5.2 Integration Tests (batch-re-matching.integration.test.ts)

```typescript
describe('End-to-End Batch Re-matching', () => {
  it('should process full batch with dry-run', async () => {
    // Create test ExpenseEntry records
    // POST /api/admin/expenses/re-match-categories {dryRun: true}
    // Assert: Returns preview without DB changes
  });

  it('should commit changes when dryRun=false', async () => {
    // Create test ExpenseEntry records
    // POST /api/admin/expenses/re-match-categories {dryRun: false}
    // Verify: ExpenseEntry.category updated in DB
    // Verify: AIUsageLog created
    // Verify: BatchReMatchJob marked COMPLETED
  });

  it('should track progress correctly', async () => {
    // POST to start batch
    // GET /api/admin/expenses/re-match-categories/[jobId]
    // Assert: Progress increments as batch processes
  });
});
```

---

## 6. Performance & Scaling

### 6.1 Phase 1 (Sync) Limits

- **Max batch size**: 5000 records
- **Processing time**: ~200ms per record
- **Total time**: 1000 records = ~3–5 minutes
- **API timeout**: 30 seconds (with long-poll client-side)

### 6.2 Phase 2 (Async) Enhancements

- Background job queue (Bull/BullMQ)
- Real-time progress via SSE
- Unlimited batch size
- Scheduled jobs support

---

## 7. Migration & Deployment

### 7.1 Prisma Migration

```sql
-- Create BatchReMatchJob table
CREATE TABLE "BatchReMatchJob" (
  "id" TEXT PRIMARY KEY,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "userId" TEXT NOT NULL,
  "filter" JSONB NOT NULL,
  "options" JSONB NOT NULL,
  "totalRecords" INT NOT NULL,
  "processedCount" INT DEFAULT 0,
  "successCount" INT DEFAULT 0,
  "failureCount" INT DEFAULT 0,
  "skippedCount" INT DEFAULT 0,
  "changesSummary" JSONB,
  "embeddingTokensUsed" INT DEFAULT 0,
  "estimatedCostUSD" DECIMAL(10, 2) DEFAULT 0,
  "errors" JSONB,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  INDEX ("userId", "status"),
  INDEX ("createdAt")
);
```

---

## 8. Next Steps

1. Implement tests (TDD)
2. Implement services
3. Create API routes
4. Integration testing
5. Load testing (1000+ records)
6. Phase 2 planning (async queue + UI)
