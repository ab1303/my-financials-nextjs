# Cleansing Donations — DEBIT Transaction Linking (LLD)

This LLD documents the exact DTOs, API contract, server scoring math, UI expectations, and tests to implement the fuzzy candidate picker for interest-cleansing DEBIT evidence.

---

## Candidate DTO — Full replacement block (copy-paste)

```typescript
// src/server/services/bank-interest/interest-cleansing.service.ts
export type Candidate = {
  transactionId: string; // transaction.id (DEBIT evidence)
  date: string; // ISO date YYYY-MM-DD (transaction.date)
  amount: number; // numeric amount (positive number)
  accountId: string; // FinancialAccount.id where the transaction occurred
  accountName: string; // Human-friendly account display name
  description: string; // transaction.description

  // Canonical match percent shown in UI badge. Integer 0..100
  matchPercent: number;

  // Short & long textual reasons for display
  reasonShort: string; // one-line short summary (e.g. "amount + date match")
  reasonLong: string; // longer explanation used in tooltip or expandable area

  // Primary score used for server-side thresholding; equals matchPercent
  score: number; // integer 0..100 (same as matchPercent, present for backward compatibility)

  // Detailed breakdown: rawNormalized are [0..1] floats. contributionsPercent are integers
  // representing each component's contribution to the total matchPercent and MUST sum to matchPercent
  scoreBreakdown: {
    rawNormalized: {
      amountScore: number; // 0..1
      dateScore: number; // 0..1
      descScore: number; // 0..1
      accountScore: number; // 0..1
    };
    contributionsPercent: {
      amount: number; // integer (e.g. 40)
      date: number; // integer (e.g. 20)
      desc: number; // integer (e.g. 30)
      account: number; // integer (e.g. 10)
    };
  };
};
```

## Server scoring math (norms & weights)

- Normalization: compute rawNormalized component scores in [0..1] as currently implemented (amount proximity, date proximity, token overlap for description, account match as 0/1). Ensure no negative values. If any rawNormalized is NaN or undefined, treat it as 0.
- Weights (canonical): amount 0.4, date 0.2, desc 0.3, account 0.1.
- Compute combinedNormalized = clamp(0,1, amountScore*0.4 + dateScore*0.2 + descScore*0.3 + accountScore*0.1).
- `matchPercent = Math.round(100 * combinedNormalized)`.
- To produce `contributionsPercent`: multiply each rawNormalized by its weight, then divide by combinedNormalized to get relative share, multiply by `matchPercent`. For deterministic integer results, compute each contribution as `Math.round(weight*rawNormalized/combinedNormalized * matchPercent)` and then correct for rounding drift by adjusting the largest contributor to ensure the sum equals `matchPercent` (when combinedNormalized > 0). If combinedNormalized === 0, all contributions are 0.

## API contract (tRPC)

- Procedure: `bankInterest.getCleansingDebitCandidates` keeps inputs unchanged. Returned array now follows the `Candidate` DTO above. Add JSDoc comments in `src/server/trpc/router/bank-interest.ts` indicating the new fields and meanings.

## Frontend requirements (CleansingCandidatePicker)

- Render each candidate row with:
  - Left: `DEBIT` type badge (green/outlined) and `accountName` text
  - Center: description and a small meta line with date and `reasonShort`
  - Right: bold amount and `matchPercent` badge with color thresholds: >=80 green, 50-79 amber, <50 gray
- Provide a tooltip or chevron to reveal `reasonLong` and the `scoreBreakdown.contributionsPercent` values.
- Add an `All accounts` dropdown (default) that filters candidates by `bankAccountId` when selected; when `All accounts` is chosen, pass no `bankAccountId` to the query.
- Search box: 300ms debounce (already present). `search` should filter description tokens and numeric amount strings.
- Selection: clicking a row marks it selected (visual highlight) and enables Confirm; keyboard navigation and Enter to select must be supported. Confirm triggers the existing allocation/apply flow.

## Tests (file-level guidance)

- Unit: scoring math
  - File: `src/server/services/bank-interest/__tests__/interest-cleansing.scoring.test.ts`
  - Assert: for controlled credit/tx pairs, `matchPercent` and `scoreBreakdown.contributionsPercent` match expected integers with rounding-correction logic.
- Integration: tRPC
  - File: `src/server/trpc/__tests__/bank-interest.getCleansingDebitCandidates.test.ts`
  - Assert: endpoint returns `Candidate` DTO with `accountName`, `matchPercent`, and contributions that sum to `matchPercent`.
- Component: picker
  - File: `src/app/(authorized)/cashflow/bank-interest/_components/__tests__/CleansingCandidatePicker.test.tsx`
  - Assert: renders match badge, account dropdown filters results, keyboard navigation selects + Confirm button enables and calls stubbed callback with selected `Candidate`.

## Test data & fixtures

- Provide fixtures mapping a sample credit transaction and multiple DEBITs with varied amount/date/description tokens to assert ordering and matchPercent values.

## Migration checklist (implementer steps)

1. Update `Candidate` type and scoring return in `src/server/services/bank-interest/interest-cleansing.service.ts` (add accountName lookup, reasonLong, compute contributionsPercent).
2. Update tRPC JSDoc and comments in `src/server/trpc/router/bank-interest.ts`.
3. Update frontend `CleansingCandidatePicker.tsx` to display new fields and interactions.
4. Add unit and integration tests as outlined above.
5. Run unit tests and manual UI verification.

## UI Layout Implementation (detailed)

To address the "squished drawer" problem, implement the main-area panel as follows:

- New component: `FullPageCleansingPanel` placed at `src/app/(authorized)/cashflow/bank-interest/_components/FullPageCleansingPanel.tsx`.
  - Props: `creditId: string`, `bankAccountId?: string`, `onClose: () => void`, `initialSearch?: string`.
  - Responsibilities: render header (title, back/close), account dropdown, search box, candidate list (reuse `CleansingCandidateList` sub-component), and Confirm/Cancel actions.
  - Layout: use a container that fills the main content area (Tailwind example: `w-full max-w-[1100px] mx-auto px-4 py-6`), with candidate list in a scrollable region `overflow-auto max-h-[calc(100vh-200px)]`.

- Integration choices:
  - Prefer showing `FullPageCleansingPanel` in-place on the current route (open when user clicks "Link evidence"), preserving side nav. This avoids a route change and keeps context.
  - Alternative: a dedicated route `/cashflow/bank-interest/cleanse/[creditId]` that mounts the same `FullPageCleansingPanel` component; useful if deep-linking or bookmarks are required.

- Accessibility & Keyboard:
  - Focus management: when opening, focus the search input. Trap focus within the panel until closed.
  - Keyboard: ArrowUp/ArrowDown navigate list, Enter selects, Esc closes. Use `aria-activedescendant` and `role="listbox"/"option"` patterns for the list.

- Visual & spacing guidance:
  - Match badge: use a small pill with `text-xs font-medium px-2 py-0.5 rounded` and background color variants (green/amber/gray).
  - Candidate rows: `flex items-start justify-between gap-4 p-3 border rounded hover:bg-slate-50` with a subtle shadow when selected.

- Tests to add for layout:
  - Component visual smoke test ensuring `FullPageCleansingPanel` renders and fills the main container.
  - Keyboard navigation test asserting Arrow keys change selection and Enter calls `onSelect`.

Notes:

- Keep `CleanseDonationDrawer` as a thin wrapper that conditionally either opens the compact drawer (feature-flag) or mounts `FullPageCleansingPanel`.
- When implementing, verify existing CSS and layout tokens from `src/styles/` to keep consistent spacing and typography.

---

## File inventory (actions)

| File                                                                                                 | Action |
| ---------------------------------------------------------------------------------------------------- | ------ |
| src/server/services/bank-interest/interest-cleansing.service.ts                                      | MODIFY |
| src/server/trpc/router/bank-interest.ts                                                              | MODIFY |
| src/app/(authorized)/cashflow/bank-interest/\_components/CleansingCandidatePicker.tsx                | MODIFY |
| src/server/services/bank-interest/**tests**/interest-cleansing.scoring.test.ts                       | ADD    |
| src/server/trpc/**tests**/bank-interest.getCleansingDebitCandidates.test.ts                          | ADD    |
| src/app/(authorized)/cashflow/bank-interest/\_components/**tests**/CleansingCandidatePicker.test.tsx | ADD    |
