## Plan: Safer Category Bulk-Apply UX

TL;DR - Prevent silent mass-updates by making bulk category changes explicit: default to single-transaction edits, surface a polite suggestion when similar transactions exist, and require an explicit preview/confirmation for any bulk apply or rule creation. Server-side matching should use pattern-based, time-scoped filters by default.

**Steps**

1. Client default: change category edits to be single-transaction only (_no implicit applyToMatching_). The inline suggestion flow triggers when `findSimilarTransactions` reports ≥2 similar rows.
2. Suggestion UI: Add a lightweight inline prompt in `TransactionRow` offering `Preview matches` / `Apply to these` / `Create rule`. Use existing `findSimilarTransactions` pattern extraction to drive the count.
3. Preview modal: implement `PreviewMatchesModal` that lists a sample of matched rows (3–5), shows match count, and exposes scoping (Recent 90 days / All time). Allow per-row deselect and `Apply` / `Cancel` actions.
4. Confirmation + API call: Only when user confirms 'Apply' call `transactionLedger.updateCategory` with explicit flags: `applyToMatching: true`, `matchScope: { type: 'recent', days: 90 } | { type: 'all' }`, and optionally `pattern` used for matching.
5. Server safety: update `applyMatchingCategoryChanges` to:
   - Require `applyToMatching === true` to run.
   - Prefer pattern-based matching (reuse `extractPattern` and `buildDescriptionFilter`) rather than strict `description` equals.
   - Default to a recent window (e.g., `date >= now() - 90 days`) unless `matchScope.allTime` is explicitly requested.
   - Keep current special-case guards for `REIMBURSEMENT_CATEGORY` and `TRANSFER_CATEGORY`.
6. Immediate UX: After bulk apply, show a transient banner "Updated X transactions — Undo" with a link to a compact review page showing the changed rows and a `Revert` or `Revert All` action.
7. Rule creation: Keep `Create rule` as a distinct flow. Creating a rule is not the same as immediate bulk-apply; after rule creation offer an explicit "Apply rule to past transactions" action (same preview/confirmation modal).
8. Tests & docs: Add unit tests for `updateCategory` (single vs bulk), for `applyMatchingCategoryChanges` scoped matching, and update `spec/transactions/category-rules/context.md` and `spec/transactions/transaction-ledger/lld.md` to record the new API contract and UX flows.

**Relevant files**

- [src/components/transactions/TransactionRow.tsx](src/components/transactions/TransactionRow.tsx) — surface suggestion, wire `Preview`/`Apply`/`Create rule` actions.
- [src/components/transactions/hooks/useCategoryEdit.ts](src/components/transactions/hooks/useCategoryEdit.ts) — stop defaulting to `applyToMatching=true`; drive suggestion visibility.
- [src/components/transactions/TransactionLedgerTable.tsx](src/components/transactions/TransactionLedgerTable.tsx) — centralize `updateCategory` call and feed new params.
- [src/server/trpc/router/transaction-ledger/mutations/updateCategory.ts](src/server/trpc/router/transaction-ledger/mutations/updateCategory.ts) — update input schema and server-side defaults/guards.
- [src/server/services/transactions/category-change.service.ts](src/server/services/transactions/category-change.service.ts) — change matching strategy and date-scoping behavior.
- [src/server/services/transactions/category-rule.service.ts](src/server/services/transactions/category-rule.service.ts) — reuse `extractPattern`/`buildDescriptionFilter` logic where appropriate.
- [src/**tests**/\*\*](src/__tests__/unit) — add tests for router and service behavior.

**Verification**

1. Unit tests: ensure `updateCategory` without bulk flags only updates one row.
2. Integration: toggle category in the UI on a row with many historical exact-description matches — verify suggestion appears and no mass change occurs until explicit apply.
3. Bulk apply path: Preview modal shows accurate sample; confirming applies only scoped rows and returns matchedIds count; undo banner reverts correctly.
4. Rule creation path: creating a rule does not auto-apply unless user explicitly chooses "Apply to past" and confirms.

**Decisions & Assumptions**

- Default behavior should be safest: single-row edits unless user explicitly requests bulk.
- Use pattern-based matching (extracted 3-word pattern) instead of strict equality to avoid brittle matches.
- Default recent window: 90 days (configurable constant) to limit accidental large updates; users may opt-in to "All time".
- Server accepts explicit `matchScope` param to avoid ambiguous boolean flags.

**Further Considerations**

1. Copy: Provide small microcopy for suggestion and modal. I can draft exact strings if you want.
2. Performance: `updateMany` with a recent window is cheap; `all-time` bulk apply may need batching or background job if users have very large datasets — consider async job for very large counts.
3. Analytics: Track bulk-apply usage to inform default window length and future UX tweaks.

If this plan looks good I will persist it (already saved to session memory) and can next: (A) draft UI text and modal wireframes, or (B) produce the minimal server-side schema diff to require explicit `matchScope` and default to no-op for `applyToMatching` unless true. Which next?
