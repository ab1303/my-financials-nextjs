# Import File Archival — High Level Design

**Feature:** `import-file-archival`
**Depends on:** `csv-import` (implemented), `ai-image-import` (implemented — S3 adapter reused)

---

## Problem Statement

When a user views Import History and wants to audit a past import, they have no way to retrieve
the original source file. The CSV upload route (`/api/transactions/csv/upload`) parses the file
in-memory, stores the parsed transactions in `ImportSession.metadata` (JSON), and discards the
raw binary. The original filename and size are recorded but the file content is gone.

Three audit scenarios that are currently impossible:
1. "What did that March 2025 import actually contain?" — need the original CSV
2. "I think a transaction was imported with the wrong amount — was it in the original file?"
3. "I want to re-import after fixing categories — can I get the file back?"

The AI image import flow already has a complete S3/Local storage adapter (`image-storage.adapter.ts`).
This feature extends the same pattern to cover CSV file archival.

---

## Goals

- Store the original CSV file at upload time (before parsing)
- Keep the file private to the uploading user — never publicly accessible
- Link the stored file to its `ImportSession` via a `csvStorageUrl` field
- Show a **"Download original"** link in Import History for sessions that have an archived file
- Support the existing Local (dev) and S3 (prod) backends without new infrastructure
- Purge the archived file when an `ImportSession` is deleted or voided (optional, see AD-5)

## Non-Goals (Phase 1)

- Re-import directly from the archived file (re-parse from stored file) — user downloads and re-uploads manually
- Archival of AI receipt/invoice images (already handled by `ai-image-import`)
- Archival of future import types (generic CSV, bank API sync)
- File versioning or diff between imports
- Virus/malware scanning of uploaded files

---

## Architecture Decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| AD-1 | **Reuse `IImageStorageAdapter`** | Extend to `IFileStorageAdapter` with an `uploadFile` method that accepts any MIME type | The S3 and Local backends are identical in structure. A renamed interface with a broader method signature avoids duplicating the S3 client setup. Existing `image-storage.adapter.ts` is the implementation reference. |
| AD-2 | **Storage path prefix** | `csv-imports/{userId}/{importSessionId}.csv` | Namespaced by feature and user. Using `importSessionId` as the filename makes the S3 key directly traceable to the DB record without an extra lookup. |
| AD-3 | **Access pattern** | Presigned URL (60-second expiry) via a new API route `/api/csv-import/download/[sessionId]` | Same pattern as AI image proxy (`/api/ai-import/image/[id]`). The file is never directly accessible from S3. The API route verifies `session.user.id === importSession.userId` before issuing the presigned URL. No public bucket ACL needed. |
| AD-4 | **Schema change** | Add `csvStorageUrl String?` to `ImportSession` | Nullable — existing sessions have no stored file. New sessions populate it at upload time. `csvStorageProvider` (enum: LOCAL/S3) stored alongside to know which adapter to use on retrieval. |
| AD-5 | **File retention on Undo** | Keep the file after Undo/void | The file is audit evidence. Purging it on Undo would defeat the purpose of archival. File is only deleted if the `ImportSession` itself is hard-deleted (pending session cleanup). |
| AD-6 | **Upload timing** | Store file BEFORE parsing, at the top of the upload route | If parsing fails, the file is still archived (useful for debugging). The `csvStorageUrl` is written to `ImportSession` metadata immediately. If storage fails, log a warning but do not fail the upload — archival is best-effort in Phase 1. |
| AD-7 | **Local dev storage path** | `uploads/csv-imports/{userId}/` | Same convention as `uploads/ai-imports/`. The `uploads/` directory is gitignored. |
| AD-8 | **No new S3 bucket** | Reuse `AWS_S3_BUCKET` | CSV files are small (<5MB limit already enforced). Separating buckets adds operational overhead with no benefit at this scale. Path prefix (`csv-imports/`) provides logical separation within the bucket. |

---

## Data Model Changes

### `ImportSession` — add two fields

```prisma
model ImportSession {
  // ... all existing fields unchanged ...

  csvStorageUrl      String?                // S3 key or local relative path
  csvStorageProvider StorageProviderEnum?   // LOCAL | S3 — null for old sessions
}
```

`StorageProviderEnum` already exists in the schema (used by `AIImportSession`). No new enum needed.

**Migration:** Non-breaking `ALTER TABLE ADD COLUMN` — all existing rows get `NULL`.

---

## Component / Service Changes

### 1. Extended storage adapter

**File:** `src/server/services/ai-import/image-storage.adapter.ts` (extend existing)

Add `uploadFile(file: Buffer, mimeType: string, key: string): Promise<StorageResult>` to
`IImageStorageAdapter` (rename interface to `IStorageAdapter`). Both `LocalStorageAdapter` and
`S3StorageAdapter` implement the new method. Existing `uploadImage` callers are unaffected.

### 2. CSV upload route

**File:** `src/app/api/transactions/csv/upload/route.ts` (modify)

At the top of the POST handler, after auth check and before parsing:
```typescript
// Best-effort archival — do not fail the upload if storage fails
try {
  const adapter = getStorageAdapter();
  const key = `csv-imports/${session.user.id}/${importSession.id}.csv`;
  const result = await adapter.uploadFile(buffer, 'text/csv', key);
  csvStorageUrl = result.storageUrl;
  csvStorageProvider = getStorageProviderEnum();
} catch (err) {
  console.warn('CSV archival failed (non-fatal):', err);
}
```

`csvStorageUrl` and `csvStorageProvider` written into the `ImportSession` create call.

### 3. Download API route

**File:** `src/app/api/csv-import/download/[sessionId]/route.ts` (new)

```typescript
export async function GET(req: NextRequest, { params }: { params: { sessionId: string } }) {
  // 1. Auth check
  // 2. Load ImportSession — verify userId matches session.user.id
  // 3. Check csvStorageUrl is non-null
  // 4. If LOCAL: stream file directly from disk
  // 5. If S3: issue 60-second presigned URL, redirect(307) to it
  // 6. Set Content-Disposition: attachment; filename="original-import-{date}.csv"
}
```

### 4. Import History UI

**File:** `src/components/transactions/ImportSessionHistory.tsx` (modify)

Add `csvStorageUrl` to `SessionRow` type. When non-null, render a download icon link in the
Actions column alongside the Undo button:

```tsx
{session.csvStorageUrl && (
  <a
    href={`/api/csv-import/download/${session.id}`}
    download
    title="Download original CSV"
    className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
  >
    <Download className="h-3.5 w-3.5" />
    CSV
  </a>
)}
```

### 5. `listImportSessions` tRPC query

**File:** `src/server/trpc/router/transaction-clearing.ts` (modify)

Include `csvStorageUrl: session.csvStorageUrl !== null` (boolean — don't expose the raw path
to the client, just whether a file is available) in the response shape. The actual download
goes through the API route, not tRPC.

### 6. Cleanup on pending session delete

**File:** `src/server/trpc/router/transaction-clearing.ts` — `deletePendingSession` mutation

After deleting the `ImportSession`, call `adapter.deleteFile(csvStorageUrl)` if non-null.
Wrap in try/catch — do not fail the delete if S3 is unreachable.

---

## Environment Variables

```env
# Already required for AI image imports — no new variables for CSV archival
AWS_S3_BUCKET=
AWS_S3_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
IMAGE_STORAGE_PROVIDER=s3   # controls both image and CSV storage
```

Document in `.env-example` that `IMAGE_STORAGE_PROVIDER=s3` now covers CSV archival too.

---

## Success Criteria

| # | Criterion |
|---|---|
| 1 | Uploading a CSV stores the raw file; `ImportSession.csvStorageUrl` is non-null after upload |
| 2 | `/api/csv-import/download/[sessionId]` returns the file with correct `Content-Disposition` header |
| 3 | A different user's `sessionId` returns 403 |
| 4 | Sessions without `csvStorageUrl` (old sessions) show no download link in Import History |
| 5 | Sessions with `csvStorageUrl` show a download link; clicking it downloads the original file |
| 6 | If S3 storage fails at upload time, the import still succeeds (best-effort archival) |
| 7 | Deleting a pending session also deletes the stored file (best-effort) |
| 8 | `pnpm run build` passes |
| 9 | Existing CSV import tests pass unmodified |

---

## Out of Scope / Future

| Item | Notes |
|---|---|
| Re-import from archived file | Phase 2 — parse the stored CSV and re-run the wizard pre-filled |
| Archival for AI image imports | Already handled by existing `ai-image-import` flow |
| File expiry policy (e.g., delete after 7 years) | S3 lifecycle rules — ops concern, not app code |
| Virus scanning | Out of scope for personal finance app at this scale |
| Separate S3 bucket for CSV files | Unnecessary at current scale; revisit if compliance requires it |
