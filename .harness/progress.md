# Harness Progress — Current Handoff

**One entry = the active workstream.** Completed entries move to `progress-history.md`.
Agents: read this file at session start to know exactly what to work on next.

---

## 2026-06-30 — Lint + build cleanup — IN PROGRESS 🔧

**State:** Lint 336 → 9 warnings. Build passes. Test-file type errors remain.

**Already done this session:**

- Ran 4 parallel subagents (lint-batch-1..4) fixing all 336 warnings across 150 files.
- Fixed `eslint.config.mjs` to add `varsIgnorePattern/caughtErrorsIgnorePattern/destructuredArrayIgnorePattern: '^_'`.
- Fixed 9 sequential build errors introduced by subagents stripping needed `as any` casts:
  - `NewSnapshotModal.tsx` — `BankAssetEntry.balance: unknown`
  - `HoldingFormModal.tsx` — `FieldErrors<CreateFormData>` cast + `FieldErrors` import
  - `BeneficiaryFormFields.tsx` — restored `as any` for react-hook-form union `Control` types
  - `donations/actions.ts` — restored `as any` for `paymentData`
  - `CreditsDialog.tsx` + `page.tsx` — removed unused props from call site
  - `relation/business/form.tsx` — restored `clsx` import + `react-hooks/incompatible-library` disable
  - `relation/individual/form.tsx` — restored `clsx` + `: any` for map callbacks
  - `dedup.service.ts` — `as TransactionTypeEnum` cast; removed `prisma` param (now module-level import)
  - `csv/confirm/route.ts` — `as any` casts for `debitMonths`/`creditMonths`
  - `csv/upload/route.ts` — `as any` for Prisma JSON metadata
  - `TableCell.tsx` — reverted `_TValue` → `TValue` (module augmentation requires exact param names)
  - `TelInput.tsx` — cast `country as any as Country`; `(countries as Country[]).find`
  - `classify/route.ts` — removed stale `prisma` arg from `findDuplicatesForClassifiedMonths`

**Current state:**
- `pnpm run build` ✅ — passes cleanly
- `pnpm run lint:evaluate:json` — 0 errors, **9 warnings** (all intentional `as any` with eslint-disable comments)
- `pnpm run type-check` ❌ — test-file type errors remain (prod files all pass)

**Remaining work (next session):**

### 1. Fix test-file type errors (`pnpm run type-check`)
These are all in `src/__tests__/` and `e2e/`:

- `CategoryGroupsDrawer.test.tsx` L132, L148, L230 — `Cannot find name 'user'` (agent renamed to `_user` but code at those lines still uses `user`). Fix: change back to `user` in those tests, keep `_user` only where truly unused.
- `cashflow-analytics.route.test.ts` L26 — `null` not assignable to `NextMiddleware`
- `charity-tax.test.ts` L23 — `mockResolvedValue` not on `never` (agent changed `any` to wrong type)
- `CleansingCandidatePicker.test.tsx` L79, L83 — mock not assignable to `UseTRPCQueryResult`
- `donation-zakat-core.test.ts` L39, L69, L95, L150 — `mockResolvedValue` not on `never`
- `IncomeTableClient.monthHeader.test.tsx` L83-217 — `Mock<()=>...>` not assignable to action types
- `interest-cleansing-phase3.test.ts` L419, L420, L529 — wrong types on Prisma query mock
- `interest-cleansing.scoring.test.ts` L36, L37, L88, L89 — `mockResolvedValue` not on `never`
- `bank-interest.getCleansingDebitCandidates.test.ts` L36, L37 — same
- `find-duplicates.service.test.ts` L16, L52 — `prisma` not in function signature (function was updated to use module-level prisma)
- `SourceBadge.contrast.test.tsx` L62 — spread on `unknown` type
- `stock-asset.schema.test.ts` L220 — `data.holdings` possibly undefined
- `TableCell.amount.test.tsx` L37, L43 — spread on `unknown` type
- `transfer-rule-job.test.ts` L133 — `transferMatchRule` not on `never`

**Key pattern for `mockResolvedValue not on 'never'`:** The agent changed `any` to `unknown` in mock setup, but prisma mock methods on `unknown` type don't have `.mockResolvedValue`. Fix: use `vi.mocked(prisma.model.method).mockResolvedValue(...)` or cast the mock correctly.

**Key pattern for `find-duplicates.service.test.ts`:** The `findDuplicatesForClassifiedMonths` function no longer accepts `prisma` parameter. Remove `prisma` from the test call.

**Key pattern for spread on `unknown`:** Agent changed `as any` to `unknown`. `{...unknown}` doesn't compile. Fix: use `as Record<string, unknown>` or restore `as SomeSpecificType`.

### 2. Resolve the 9 remaining lint warnings
All are `no-explicit-any` with `eslint-disable` comments. These are legitimate (library type limitations). Either:
- Accept them as intentional technical debt (they're suppressed, no impact)
- Or refactor to use proper type-safe wrappers (lower priority)

**Next session starts at:** Run `pnpm run type-check 2>&1 | grep "error TS"` to see current state, then fix test-file errors using the patterns above.
