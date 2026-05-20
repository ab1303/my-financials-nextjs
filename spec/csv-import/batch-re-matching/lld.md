# Batch Re-matching Expense Categories — LLD

## Implementation Phases

### Phase 1 — Matching Services
- Create `batch-matcher.service.ts`:
  - `filterExpenseEntries(filter)`,
  - `matchAndCompare(entries, options)`,
  - `aggregateChangeset(results)`.
- Use embedding match service with configurable similarity threshold and throttling.

### Phase 2 — Job Orchestration
- Create `batch-job.service.ts`:
  - start job,
  - avoid duplicate in-progress jobs,
  - process entries with retry + partial failure handling,
  - persist progress/result summaries.

### Phase 3 — Admin API
- `POST /api/admin/expenses/re-match-categories` to start jobs.
- `GET` list/retrieve status; `DELETE` cancel job where supported.
- Role/ownership checks before access.

## Interfaces

- `BatchReMatchFilter` (category/import session/date/similarity).
- `BatchReMatchOptions` (dryRun/maxBatchSize/throttleRate).
- `MatchResult` (`updated|skipped|error` + similarity + reason).
- `BatchReMatchJobResult` progress and cost summary.

## Database Pattern

- Add `BatchReMatchJob` Prisma model to store:
  - status lifecycle,
  - serialized filter/options,
  - processed/success/failure/skipped counts,
  - `changesSummary`,
  - token/cost estimates,
  - error payload.
- Update `ExpenseEntry.category` on commit mode only.
- Log batch usage to `AIUsageLog`.

## Error Handling

| Scenario | Handling |
|---|---|
| No matching records | validation error |
| Single-entry matching failure | record error, continue |
| Embedding API transient error | retry then skip/error |
| Dry-run mode | no DB category updates |
| Job-level fatal error | mark `FAILED`, persist error payload |

## Acceptance Criteria

- Dry-run preview returns deterministic proposed changes.
- Commit mode updates eligible entries only.
- Progress/status endpoints reflect real counts.
- Partial failures do not invalidate successful updates.
- Cost and token usage are recorded per batch.

## File Inventory

| File | Action | Notes |
|---|---|---|
| `src/server/services/batch-re-matching/_types.ts` | CREATE | domain job/result types |
| `src/server/services/batch-re-matching/batch-matcher.service.ts` | CREATE | matching logic |
| `src/server/services/batch-re-matching/batch-job.service.ts` | CREATE | orchestration |
| `src/app/api/admin/expenses/re-match-categories/route.ts` | CREATE | start/list API |
| `src/app/api/admin/expenses/re-match-categories/[jobId]/route.ts` | CREATE | status/cancel API |
| `prisma/schema.prisma` | MODIFY | `BatchReMatchJob` model |
| `src/__tests__/unit/batch-matcher.service.test.ts` | CREATE | unit tests |
| `src/__tests__/integration/batch-re-matching.integration.test.ts` | CREATE | integration tests |
