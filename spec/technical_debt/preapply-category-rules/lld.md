Low-level design: Pre-apply Category Rules Before LLM

## Overview

This LLD specifies the code-level changes required to pre-apply category rules in-memory prior to calling the LLM classifier during CSV import classification. It emphasises reuse of matching logic to avoid drift, safe regex handling, provenance capture, and a feature-flagged rollout.

## Phases

- Phase 1 (MVP): Implement in-memory pre-apply and stream `preMatch` annotations to the client via SSE. Do not persist `appliedRuleId` to the `transaction` table in this phase. If any server-side persistence of annotations is required for reliability, store them in `importSession.metadata.preAppliedRules` as a fallback.
- Phase 2 (Provenance persistence): Implement DB schema changes and migrations to persist provenance on the `transaction` record (either via `metadata` JSON column or a dedicated `appliedRuleId` column). Update `createTransactionRecord`, `runCategoryRules`, tests, and any querying code to account for the persisted provenance. This phase should be planned as a separate migration task with backwards compatibility considerations.

## New module

`src/server/services/transactions/category-rule-applier.ts`

- Exports:
  - `async function loadActiveRules(prisma, userId): Promise<Rule[]>` — loads active rules with necessary fields: `id, pattern, matchType, category, updatedAt`.
  - `function applyCategoryRulesToTransactions(transactions, rules, opts?): { matched, unmatched, annotations }`
    - `transactions`: array of parsed CSV transactions { id, date, description, amount, type }
    - `rules`: array from `loadActiveRules`
    - `opts`:
      - `maxRegexLength` (default 2000)
      - `skipUnsafeRegex` (default true)
    - Returns:
      - `matched`: array of `{ tx, ruleId, matchedCategory }`
      - `unmatched`: remaining txs
      - `annotations`: per-tx metadata for SSE/UI (appliedRuleId, matchedCategory, matchType)

## Matcher semantics (must match DB semantics)

- Normalization: `description = (description ?? '').trim()`; comparisons use case-insensitive matching where DB used `LOWER(...)`.
- Match types:
  - `EXACT`: `normalizedDescription === normalizedPattern`
  - `CONTAINS`: `normalizedDescription.includes(normalizedPattern)`
  - `REGEX`: `new RegExp(pattern, 'iu')` (try/catch; if invalid or too long skip/flag)
- Precompile regex in `try { new RegExp(p, 'iu') } catch(e) { skip }`.
- If multiple rules match a tx, apply deterministic precedence: `lastUpdatedAt desc, id asc` (documented and same as DB approach).

## Integration: classify route

File: `src/app/api/transactions/csv/classify/route.ts`
Changes:

- Import `loadActiveRules` and `applyCategoryRulesToTransactions`.
- After grouping transactions by month, call:
  ```ts
  const rules = await loadActiveRules(prisma, userId);
  const { matched, unmatched, annotations } = applyCategoryRulesToTransactions(
    monthTransactions,
    rules,
  );
  // Stream annotations and matched rows to client as RULE_MATCH pre-assignments
  // Only call classifyTransactions(unmatched, categories)
  ```
- SSE payload: augment existing event objects with `preMatch?: { ruleId?: string; category?: string; matchType?: string }` and `sourceHint: 'RULE_MATCH' | 'LLM_SUGGESTED'`.

## Persist provenance: confirm/CSV save (Phase 2)

Files: `src/app/api/transactions/csv/confirm/route.ts`, `src/server/services/transactions/csv-confirm.service.ts`
Changes:

- Phase 2 only: The client will POST reviewed months including pre-matched annotations. When persisting a tx that was pre-matched:
  - Set `source = 'USER_OVERRIDE'` and persist provenance via `metadata.appliedRuleId` or a dedicated `appliedRuleId` column.
  - Update `createTransactionRecord(...)` signature to accept `appliedRuleId?: string` and persist appropriately. Example:
    ```ts
    await prisma.transaction.create({ data: { ..., source: 'USER_OVERRIDE', metadata: { appliedRuleId } } });
    ```
  - If the project decides to defer schema changes, continue using `importSession.metadata` as the fallback storage for provenance until Phase 2 is executed.

## Adjust DB safety net

File: `src/server/services/transactions/category-rule.service.ts`
Changes:

- When `runCategoryRules(...)` iterates rules for an `importSession`, in Phase 2 exclude transactions where `metadata.appliedRuleId` exists OR `source = 'USER_OVERRIDE'` and `appliedRuleId IS NOT NULL` to avoid reapplying. In Phase 1, the DB job should be conservative and treat `source = 'USER_OVERRIDE'` as an indicator to skip if present, but rely on `importSession.metadata` for any audit-only data.
- Keep `runCategoryRules` as backup to catch transactions that were missed or where rules were added after import.

## Feature flag and config

- Env: `CSV_PRE_APPLY_RULES` (default `false`). Toggle enables pre-filtering path.
- Env: `CSV_PRE_APPLY_RULES_MAX_REGEX_LEN=2000` and `CSV_PRE_APPLY_RULES_SKIP_UNSAFE_REGEX=true`.

## Safety and validation

- Validate rule patterns at load-time: reject or skip extremely long patterns, invalid regex, or patterns flagged by a simple `safe-regex` heuristic.
- Limit number of rules scanned per import (configurable, default 1000). If exceeded, log a warning and fallback to existing behaviour (classify all).

## Client changes (SSE + UI annotations)

- SSE: include `preMatch` object in events so UI shows `Rule: <name>` for pre-assigned rows and marks them as editable.
- `TransactionReviewTable.tsx`: show `preMatchedByRule` and allow user override; when user overrides, mark `overridden: true` as current flow does.

## Testing

- Unit tests for `applyCategoryRulesToTransactions` covering EXACT, CONTAINS, REGEX, precedence, and edge cases.
- Integration test for `classify` SSE asserting LLM is called only for unmatched rows (mock AI provider).
- E2E: Phase 1 — upload -> classify -> confirm: ensure pre-matched rows appear in the UI and persist the confirmed category; do NOT assert `appliedRuleId` persistence. Phase 2 — after migration: assert `appliedRuleId` is persisted and `source = USER_OVERRIDE`.

## Rollout

1. Merge behind `CSV_PRE_APPLY_RULES=false`.
2. Run tests and enable flag in staging for a subset of users.
3. Monitor logs/metrics (matched counts, tokens saved, user overrides) for 1 week.
4. Enable broadly and optionally remove `runCategoryRules` import-scope behaviour after confidence (long-term decision).

## Open questions

- Where to persist `appliedRuleId` if `transaction.metadata` does not exist? (Prefer `importSession.metadata` as fallback.)
- Do we want a per-rule disable on pre-apply (UI toggle)? Implementation could fetch `active` flag only.
