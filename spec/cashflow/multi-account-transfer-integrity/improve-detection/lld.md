# Improve Detection — Low Level Design

## Overview

Improves the transfer matching algorithm with two targeted changes:
1. **Widen the date tolerance** for cross-institution transfers from ±5 days to ±10 days
2. **Respect the `isTracked` flag** — skip transfer candidate scoring when one account is untracked

This is a **service-layer change** touching only `transfer.service.ts` and `constants.ts`.

**Depends on:** `handle-orphans` (Phase 3 must be deployed first — requires `FinancialAccount.isTracked`
to exist in the database).

---

## Files to Modify

| File | Change |
|---|---|
| `src/server/services/transactions/constants.ts` | Add `TRANSFER_DATE_TOLERANCE_DAYS_CROSS` |
| `src/server/services/transactions/transfer.service.ts` | Widen date tolerance for cross-institution; respect `isTracked` in candidate scoring |

---

## 1. Constants Addition

```typescript
// src/server/services/transactions/constants.ts — ADD:

export const TRANSFER_DATE_TOLERANCE_DAYS = 5;         // existing — same institution
export const TRANSFER_DATE_TOLERANCE_DAYS_CROSS = 10;  // NEW — cross-institution (YNAB standard)
export const TRANSFER_AMOUNT_FEE_TOLERANCE = 10;        // existing — consider raising to 50 for international
```

---

## 2. Cross-Institution Date Tolerance

The existing scoring algorithm uses a single `TRANSFER_DATE_TOLERANCE_DAYS` (currently 5)
for all transfers. Cross-bank transfers routinely take 2–4 business days, so same-day
matching misses many legitimate pairs.

### 2.1 Determine if Transfer is Cross-Institution

```typescript
// In transfer.service.ts — getCandidates() or equivalent scoring function

const debitAccount = await ctx.prisma.financialAccount.findUnique({
  where: { id: debitTx.bankAccountId },
  select: { institutionId: true, isTracked: true },
});
const creditAccount = await ctx.prisma.financialAccount.findUnique({
  where: { id: creditTx.bankAccountId },
  select: { institutionId: true, isTracked: true },
});

const sameBankTransfer =
  debitAccount?.institutionId != null &&
  debitAccount.institutionId === creditAccount?.institutionId;

const dateTolerance = sameBankTransfer
  ? TRANSFER_DATE_TOLERANCE_DAYS        // ±5 days same institution
  : TRANSFER_DATE_TOLERANCE_DAYS_CROSS; // ±10 days cross-institution
```

> Verify the field name used for institution identity in `FinancialAccount` — it may be
> `institutionId`, `institutionName`, or `bank`. Use whatever unambiguously identifies
> the bank, not just the account name.

### 2.2 Apply Dynamic Tolerance to Date Scoring

The date proximity score currently uses a hardcoded tolerance. Replace with the dynamic value:

```typescript
// Existing date score calculation — replace hardcoded constant:
// BEFORE: const daysDiff = Math.abs(diffDays(debitTx.date, creditTx.date));
//         const dateScore = Math.max(0, 30 - (daysDiff / TRANSFER_DATE_TOLERANCE_DAYS) * 30);
// AFTER:
const daysDiff = Math.abs(diffDays(debitTx.date, creditTx.date));
if (daysDiff > dateTolerance) return { score: 0 }; // Outside window entirely
const dateScore = Math.max(0, 30 * (1 - daysDiff / dateTolerance));
```

---

## 3. Respect `isTracked` Flag

When one account is `isTracked = false`, the user has declared this account is outside their
tracked universe. Auto-matching should be skipped — the debit/credit should remain as a real
expense/income (the "budget boundary crossing" model).

```typescript
// Early exit in candidate scoring:
if (!debitAccount?.isTracked || !creditAccount?.isTracked) {
  return {
    score: 0,
    skipReason: 'untracked_account',
    // Logging: useful for debugging
  };
}
```

This ensures:
- Untracked→Tracked transfers: CREDIT remains as income (money entering tracked universe)
- Tracked→Untracked transfers: DEBIT remains as expense (money leaving tracked universe)
- No false transfer links across the budget boundary

---

## 4. Batch Job Considerations

If the transfer matching runs as a batch job post-import (via `TransferMatchJobResult`),
the `isTracked` check must happen inside the batch job's candidate loop, not just in
the on-demand `getCandidates` API.

> Verify whether the batch job reuses the same scoring function or has its own loop.
> If separate, apply the same `isTracked` guard to both paths.

---

## 5. Acceptance Criteria

- [ ] `TRANSFER_DATE_TOLERANCE_DAYS_CROSS = 10` is defined in `constants.ts`
- [ ] Cross-institution transfer pairs (different `institutionId`) are scored with ±10 day window
- [ ] Same-institution transfer pairs retain ±5 day window (no regression)
- [ ] Transfer candidates between accounts where either `isTracked = false` return `score: 0`
- [ ] A DEBIT to an untracked account does NOT get auto-linked as a transfer (remains as expense)
- [ ] A CREDIT from an untracked account does NOT get auto-linked as a transfer (remains as income)
- [ ] Existing passing transfer match tests still pass after changes

---

## 6. Open Design Question

| # | Question | Recommended Answer |
|---|---|---|
| Q1 | Should `TRANSFER_AMOUNT_FEE_TOLERANCE` be raised from $10 to $50 for international wire fees? | Yes — $10 is too tight for international transfers. Raise to $50 as default, or expose as user-configurable setting. Decide before implementing this slice. |

---

## 7. Implementation Notes

- **Requires `handle-orphans` Phase 3 to be deployed first** — `FinancialAccount.isTracked`
  must exist in the database schema before this service change can read it.
- **No new tRPC procedures** — this is an internal service layer change.
- **No UI changes required** — the improved matching is transparent to the user.
- **Do not** run `pnpm lint --fix`, global formatters, or touch files outside the scope above.
