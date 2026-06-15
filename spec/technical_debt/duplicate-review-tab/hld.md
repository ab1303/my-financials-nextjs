Duplicate Review Tab — High Level Design

## Goal

Add a "Duplicates" review tab to the CSV import review flow that lists CSV rows which appear to be duplicates of existing transactions (as determined by `makeDedupKey()`), allowing users to inspect and selectively force-create duplicates that would otherwise be skipped during confirm.

## Key Decisions

- Dedup detection: reuse existing `makeDedupKey()` and `buildDedupSet()` logic (exact-match key). No new fuzzy matching in this iteration.
- UI placement: within the CSV import review/confirm step as a separate tab labeled "Duplicates".
- Default checkbox state: unchecked. Users must opt-in to force-create duplicates.
- API: extend confirm endpoint to accept `forceCreateIds: string[]` (CSV row IDs) to bypass server-side dedup for those rows.
- Rollout: immediate (no feature flag).

## Success Criteria

- Users can see all candidate duplicate CSV rows with a side-by-side view of the CSV row and the matched transaction(s).
- Users can select any subset (or Select All) to force-create; selected items are created even if they match existing dedup keys.
- Confirm report includes per-row result and surface errors for failed forced creates.

## Non-Goals

- Changing the dedup algorithm (keep exact-match behavior).
- Automatic merging or auto-resolving of duplicates.

## Files Produced

- `spec/technical_debt/duplicate-review-tab/hld.md`
- `spec/technical_debt/duplicate-review-tab/context.md`
- `spec/technical_debt/duplicate-review-tab/lld.md`
