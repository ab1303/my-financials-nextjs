# LLM Classification for Categories — LLD

## Implementation Phases

### Phase 1 — Classifier Service
- Add `csv-classifier.service.ts`:
  - receives month transactions + active categories,
  - builds system/user prompts,
  - performs one batched LLM call,
  - parses JSON output into `ClassifiedTransaction[]`,
  - falls back to raw-description category when call/parse fails.

### Phase 2 — Classify SSE Route
- Add `POST /api/csv-import/classify`.
- Validate body (`fileId`, `calendarId`), authorize session owner.
- Group transactions by month and emit:
  - `progress`,
  - `classified` (with per-month usage),
  - `warning`/`error`,
  - `done`.

### Phase 3 — Confirm Route + Override Persistence
- Add `POST /api/csv-import/confirm`.
- Validate `ConfirmImportRequest`.
- For each month:
  - build extraction payload from `confirmedCategory`,
  - call `mapExpenseData(...)`,
  - upsert `TransactionCategoryOverride` (`llm_confirmed` or `user_override`).
- Update `AIImportSession` status and write `AIUsageLog`.

## Interfaces + Schemas

```ts
interface ClassifiedTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  llmCategory: string;
  confirmedCategory: string;
  overridden: boolean;
}
```

Zod additions:
- `ClassifyRequestSchema`
- `ConfirmImportRequestSchema`
- nested `ClassifiedTransactionSchema`

## Database Pattern (Prisma)

- `transactionCategoryOverride.upsert` keyed by `(userId, normalizedDescription)`.
- `aIImportSession.update` for terminal status.
- `aIUsageLog.create` for LLM token/cost recording.
- Reuse existing `Expense`/`ExpenseEntry` creation via mapper service.

## Error Handling

| Scenario | Behavior |
|---|---|
| LLM call failure/malformed output | fallback categories + warning event |
| Invalid request body | `400` JSON |
| Session not found/forbidden | `404` / `403` JSON |
| Per-month confirm save failure | continue with partial status |
| Override upsert failure | log warning; do not fail month save |

## Acceptance Criteria

- Classification stream returns month-grouped transactions.
- Users can override categories before confirm.
- Confirm endpoint persists entries and overrides.
- AI usage logs capture non-zero token usage where applicable.
- Session status accurately reflects complete vs partial failures.

## File Inventory

| File | Action | Notes |
|---|---|---|
| `src/server/services/ai-import/csv-classifier.service.ts` | CREATE | LLM classifier |
| `src/app/api/csv-import/classify/route.ts` | CREATE | SSE classify |
| `src/app/api/csv-import/confirm/route.ts` | CREATE/MODIFY | confirm persistence |
| `src/server/services/ai-import/validation.ts` | MODIFY | classify/confirm schemas |
| `src/server/services/ai-import/_types.ts` | MODIFY | classified payload types |
| `prisma/schema.prisma` | MODIFY | `TransactionCategoryOverride` model |
| `src/components/csv-import/TransactionReviewTable.tsx` | CREATE/MODIFY | review override UI |
