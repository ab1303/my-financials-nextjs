Duplicate Review Tab — Context

## Problem

When importing CSVs, some rows are silently skipped by the confirm step due to server-side deduplication (`makeDedupKey()` exact-match). The CSV file is the source of truth and users need visibility and control when duplicates are detected so they can intentionally create rows that look like existing transactions (for example, repeated payments, refunds, or intentionally duplicated entries).

## Scope

- Show candidate duplicate CSV rows discovered during classification/confirm.
- Allow users to select rows to force-create, passing selection to the backend which will bypass dedup for those rows.
- Preserve existing dedup algorithm and server-side safety checks (only bypass dedup for explicitly selected CSV IDs).

## Constraints

- No DB writes or data-altering operations will be performed by diagnostic tools; changes to persistent behavior are implemented through the confirm flow when user submits confirm.
- Implementation must be conservative: only create when user explicitly requests via force-create selection.
- Tests must be added to verify both normal dedup behavior and force-create behavior.

## Acceptance Criteria

1. Spec files exist in `spec/technical_debt/duplicate-review-tab/`.
2. The UI presents duplicate candidates with CSV row and matched transaction details.
3. The confirm API accepts an array `forceCreateIds` to create selected duplicates.
4. Server creates forced duplicates and returns per-row results; non-selected duplicates remain skipped and counted in `duplicatesSkipped`.
