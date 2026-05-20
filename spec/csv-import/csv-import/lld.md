# CSV Import Upload & Parse — LLD

## Implementation Phases

### Phase 1 — Upload Route
- Implement `POST /api/csv-import/upload` with:
  - `auth()` guard.
  - multipart `formData` (`files` field).
  - CSV MIME/extension and max size checks.
  - parse invocation and debit transaction extraction.
  - `AIImportSession.create({ status: PENDING, metadata: { fileName, fileSize, transactions } })`.
- Return `CsvUploadResponse` with `fileId`, counts, and parsed rows.

### Phase 2 — Parse/Classify Stream Route
- Implement stream endpoint (`POST /api/csv-import/parse` or classify route based on active flow).
- Validate request body via Zod.
- Fetch + authorize session ownership.
- Group `metadata.transactions` by month.
- For each month:
  - emit `progress`,
  - build extraction payload,
  - call `mapExpenseData(...)`,
  - emit `saved` / `error`.
- Update session final status and emit `complete`.

### Phase 3 — Shared Contracts
- Add/confirm `CsvTransaction`, `CsvParseResult`, `CsvUploadResponse`, `CsvParseRequest`.
- Add Zod schema(s) in validation service for parse/classify request payload.

## Interfaces and Contracts

```ts
interface CsvTransaction {
  date: string;
  month: number;
  year: number;
  description: string;
  amount: number;
  type?: 'DEBIT' | 'CREDIT';
  balance?: number;
}

interface CsvUploadResponse {
  fileId: string;
  fileName: string;
  fileSize: number;
  rowCount: number;
  transactions: CsvTransaction[];
}
```

SSE event contract:
- `progress`: current month progress.
- `saved`: month result and created count.
- `error`: month or stream error.
- `complete`: final aggregate status.

## Zod Schemas

- `CsvParseRequestSchema` minimum:
  - `fileId: string`
  - `importType: 'EXPENSE'` (if parse route path used)
  - `context.calendarId: string`

## Database Pattern (Prisma)

- `aIImportSession.create` during upload.
- `aIImportSession.findUnique` + ownership check before stream processing.
- `aIImportSession.update` at completion with `status`, `recordsCreated`, `overallConfidence`.
- `aIUsageLog.create` for embedding/classification usage as best-effort side effect.

## Error Handling Matrix

| Condition | Response |
|---|---|
| Unauthenticated | `401` JSON |
| Invalid upload payload/type/size | `400` JSON |
| Session missing | `404` JSON |
| Session ownership mismatch | `403` JSON |
| Month-level processing failure | SSE `error`, continue |
| All groups fail | final session `FAILED` |

## Security Checklist

- Auth required on upload + parse/classify.
- Session ownership required on parse/classify + confirm-like actions.
- Strict MIME/size/row limits.
- No secret leakage in client payloads.
- Graceful handling for AI service failures.

## Acceptance Criteria

- CSV uploads create `AIImportSession` with parsed rows.
- Parse/classify stream reports progress and final status.
- Debits are normalized and grouped by month correctly.
- Session statuses are deterministic (`COMPLETED/PARTIAL/FAILED`).
- Invalid files/requests fail with explicit errors before stream starts.

## File Inventory

| File | Action | Notes |
|---|---|---|
| `src/app/api/csv-import/upload/route.ts` | MODIFY | upload validation + session create |
| `src/app/api/csv-import/parse/route.ts` | MODIFY | SSE month processing |
| `src/server/services/ai-import/_types.ts` | MODIFY | CSV request/response/domain types |
| `src/server/services/ai-import/validation.ts` | MODIFY | parse/classify request schemas |
| `src/server/services/ai-import/expense-mapper.service.ts` | REUSE | category write path |
| `src/server/services/ai-import/category-matcher.service.ts` | REUSE | semantic matching |
