# Cleansing — DEBIT Candidate Picker (LLD)

## Phase Map

1. Service: reuse/extend existing `suggestAllocations` (credit-anchored, returns suggestion objects). Prefer extending this service to avoid regressions.

- Note: `suggestAllocations` already exists in `src/server/services/bank-interest/interest-cleansing.service.ts` and returns `donationPaymentId`, `evidenceAmount`, `score`, and `suggestedAmount`. Reuse it as the canonical candidate API and adapt the frontend to use its shape.

2. tRPC: expose `getCleansingDebitCandidates` (optional alias) with zod input validation if a renamed endpoint is preferred.
3. tRPC: expose `getCleansingDebitCandidates` with zod input validation.
4. UI: Add `CleansingCandidatePicker` and wire into `CleanseDonationDrawer` (debounced async search, `placeholderData`).
5. Tests: unit tests for scoring, integration tests for drawer behavior.

## Service Signature

File: `src/server/services/bank-interest/interest-cleansing.service.ts`

```ts
export type Candidate = {
  transactionId: string;
  date: string;
  amount: number;
  accountId: string;
  description: string;
  score: number; // 0-100
  scoreBreakdown: {
    amountScore: number;
    dateScore: number;
    descScore: number;
    accountScore?: number;
  };
  reasonShort: string;
};

export async function getCleansingDebitCandidates(params: {
  userId: string;
  creditId: string;
  bankAccountId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  minScore?: number;
}): Promise<Candidate[]>;
```

## Scoring Algorithm (recommended)

- Normalize `credit` and candidate `description` with tokenization (lowercase, strip punctuation, remove stop words).
- Components and weights (configurable):
  - `amountScore` (40%): inverse relative difference; capped logistic/linear mapping to 0..1.
  - `descScore` (30%): token overlap ratio + trigram similarity; boost numeric token matches.
  - `dateScore` (20%): proximity (higher for within `dateWindowDays`, decay beyond).
  - `accountScore` (10%): same account or known payee mapping.
- Combine: weighted sum → normalize → `score = Math.round(100 * combined)`.
- `reasonShort`: assemble short human-friendly string from top contributors, e.g., "Amount ±0.3% · Desc tokens match · Date +2d".

## Query Strategy

- Fetch a bounded superset of eligible DEBITs (e.g., `maxCandidateFetch = 200`) using Prisma query: filter by userId, type='DEBIT', status='CONFIRMED', donationPayment=null, category=configuredInterestCategoryName, optional bankAccountId/date range.
- If `search` provided, apply ILIKE `%search%` filter or tokenized filter to reduce rows before scoring.
- Score candidates in-memory, sort by `score` desc, return top `limit` (default 20) and optionally filter by `minScore`.

## tRPC Procedure (example)

File: `src/server/trpc/router/bank-interest.ts`

```ts
trpc.procedure.query('getCleansingDebitCandidates', {
  input: z.object({
    creditId: z.string(),
    bankAccountId: z.string().optional(),
    search: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    limit: z.number().int().min(1).max(50).optional(),
    minScore: z.number().min(0).max(100).optional(),
  }),
  resolve: async ({ ctx, input }) =>
    getCleansingDebitCandidates({ userId: ctx.session.user.id, ...input }),
});
```

## Frontend Integration

- Component: `CleansingCandidatePicker`
  - Props: `creditId`, `bankAccountId?`, `onSelect(candidate)`
  - Behavior: debounce user typing (300ms), call `getCleansingDebitCandidates`, show `placeholderData` when query input changes to avoid unmount.
  - Render: date, amount, amount-diff, description with highlighted tokens, `score` badge (color-coded), `reasonShort`.
- Wire into `CleanseDonationDrawer` in `Linked` mode; `handleLinkedSave` should use selected candidate's date/amount.

## Tests

- Unit: scoring function produces expected ordering for handcrafted examples.
- Unit: `reasonShort` contains dominant contributors.
- Integration: picker fetches and displays candidates; selecting candidate writes `DonationPayment.transactionId` (mocked DB) and uses debit date/amount.

## Telemetry

- Events: `interest.cleansing.suggestionShown`, `interest.cleansing.suggestionAccepted`, `interest.cleansing.manualSearch` with payloads including `creditId`, candidateIds, and scores.

## Edge Cases

- Zero/near-zero amounts: deprioritize amountScore and rely more on desc/date.
- No eligible DEBITs: show clear empty state and CTA to manual search/create donation.
- Large result sets: enforce `maxCandidateFetch` and tune DB indexes if necessary.

## Implementation Plan (detailed)

1. Service implementation

- Add `getCleansingDebitCandidates(params)` to `interest-cleansing.service.ts` following the Service Signature above.
- Implement Prisma query with a `maxCandidateFetch` (200) and optional `search` ILIKE filter.
- Compute `scoreBreakdown` (amountScore, dateScore, descScore, accountScore) and set `score = Math.round(100 * combined)`.
- Ensure deterministic sorting by `score` then `date`.

2. Tests

- Unit: `src/__tests__/unit/services/bank-interest/getCleansingDebitCandidates.test.ts` to cover filtering and scoring edge cases.
- Unit: reuse `src/__tests__/unit/utils/interest-match.test.ts` patterns for token similarity.
- Integration: lightweight test for `CleanseDonationDrawer` behavior mocking tRPC responses.

3. API & Typing

- Add tRPC procedure in `src/server/trpc/router/bank-interest.ts` with zod input and output types.
- Export TypeScript types for `Candidate` to consume in frontend components.

4. Frontend

- Create `src/app/(authorized)/cashflow/bank-interest/_components/CleansingCandidatePicker.tsx` using React, debounce, and `useQuery` from `trpc`.
- Integrate into `CleanseDonationDrawer.tsx`: swap or augment existing evidence list with the picker behind a feature flag.

5. Rollout

- Feature-flag the new picker; deploy backend changes first with tests green.
- Add telemetry and iterate weights in staging.

6. Docs & Spec

- Update `spec/cashflow/interest/cleansing-debit-linking/context.md` to reference the picker and include the acceptance criteria.
- Record weight values and test results in the feature PR for future tuning.
