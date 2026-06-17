Duplicate Review Tab — Low Level Design

## Overview

This LLD describes concrete file changes, API contracts, server behavior, and UI components needed to implement the Duplicate Review Tab and force-create flow.

## Server changes

1. `src/server/services/transactions/dedup.service.ts`
   - Add `findDuplicatesForClassifiedMonths({ prisma, userId, classifiedMonths })` which:
     - Accepts the classified months (the same shape emitted by the classifier and returned to the client).
     - Builds a dedup set using `buildDedupSet({ prisma, userId, fromDate, toDate })` for the date ranges present.
     - For each CSV-classified transaction, compute `makeDedupKey()` and return a `DuplicateCandidate` object when a match exists:
       - `{ csvId: string, dedupKey: string, matchedTransactionIds: string[], matchedTxSummary: { date, amount, description, category }[] }`

2. `src/server/services/transactions/csv-confirm.service.ts`
   - Update `confirmDebitTransactions` (and credit path if applicable) signature to accept an optional `forceCreateIds?: string[]`.
   - When iterating CSV rows to create transactions, skip dedup only if `isDuplicate(key, dedupSet)` AND the CSV row's `id` is NOT in `forceCreateIds`.
   - Return a richer summary including per-CSV-id status: `{ created: string[]; duplicatesSkipped: number; duplicatesSkippedIds: string[]; errors: Array<{ csvId, error }> }`.
   - Preserve existing logging: keep `[csv-confirm]` debug lines; add a debug line when a row is force-created.

3. tRPC route: `src/app/api/transactions/csv/confirm/route.ts` (or the server endpoint used by the client)
   - Extend request shape to include `forceCreateIds?: string[]`.
   - Validate via zod.

4. Tests (server)
   - Unit test for `findDuplicatesForClassifiedMonths` that seeds small set and verifies candidate list.
   - Unit tests for `confirmDebitTransactions`:
     - default behavior: duplicates are skipped and counted
     - with `forceCreateIds`: selected rows are created and not counted as skipped

## Client changes

1. New components (under `src/app/(authorized)/cashflow/transactions/_components/csv/`)
   - `DuplicatesTab.tsx` — tab wrapper showing header, Select All, bulk actions, and the `DuplicatesReviewTable`.
   - `DuplicatesReviewTable.tsx` — table rows with checkboxes, CSV row preview, matched transaction summary, link to matched transaction (if available), and per-row notes.

2. Integration into `CSVClassifyingStep.tsx`
   - After `onComplete` classification returns, call a new client endpoint (or reuse existing data) to fetch `DuplicateCandidate[]` for display, or compute candidates client-side using the classified months and a server `findDuplicates` helper via tRPC.
   - Present the Duplicates tab as part of the review flow; the confirm button should include `forceCreateIds` taken from checked boxes when calling the confirm API.

3. UI Behavior
   - Checkboxes default to unchecked.
   - Header checkbox toggles Select All.
   - When user clicks Confirm, call the confirm endpoint with the same payload plus `forceCreateIds`.
   - On response, show per-row success/failure and include failures in the final import report.

## API Contracts

- Confirm request (existing fields) + optional:

  {
  fileId: string,
  /_ existing payload _/,
  forceCreateIds?: string[]
  }

- Confirm response (extended):

  {
  createdCount: number,
  duplicatesSkipped: number,
  duplicatesSkippedIds: string[],
  createdIds: string[],
  errors?: Array<{ csvId: string; message: string }>
  }

## Edge cases

- If a CSV row's dedup key collides with multiple existing transactions, show all matches and let user decide.
- Race: if an existing transaction is created between classification and confirm that causes a dedup collision, force-create should still create a new transaction if selected; server must ensure unique constraints are respected (fail gracefully if DB constraint trips).

## Tests

- Unit tests for dedup helper and csv-confirm behavior as described above.
- E2E test: import CSV containing known duplicates; assert that non-selected duplicates are skipped and selected duplicates are created.

## Rollout / Monitoring

- Add server debug logs (existing `[csv-confirm]` lines) to track forced creates and skipped IDs.
- After release, run import diagnostic script against sample CSVs and verify counts align.
