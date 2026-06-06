# Interest Cleansing — Low-Level Design (LLD)

This LLD documents the candidate DTO, scoring algorithm, and API contract for the fuzzy matching evidence picker.

## Candidate DTO

```typescript
export type Candidate = {
  transactionId: string;
  date: string;
  amount: number;
  accountId: string;
  accountName: string;
  description: string;
  matchPercent: number;
  reasonShort: string;
  reasonLong: string;
  score: number;
  scoreBreakdown: {
    rawNormalized: { amountScore: number; dateScore: number; descScore: number; accountScore: number; };
    contributionsPercent: { amount: number; date: number; desc: number; account: number; };
  };
};
```

## Scoring Algorithm

1.  **Normalization**: Raw scores `[0..1]` for `amount`, `date`, `description`, `account`.
2.  **Weighting**:
    - `amount`: 0.4
    - `date`: 0.2
    - `description`: 0.3
    - `account`: 0.1
3.  **Combination**: `weightedSum` clamped `[0,1]`. `matchPercent = Math.round(100 * combinedNormalized)`.

## API Contract (tRPC)

- `bankInterest.getCleansingDebitCandidates`: Returns `Candidate[]`.
- `bankInterest.applyAllocations`: Persists `DonationPaymentEvidence` records.
- `bankInterest.suggestAllocations`: Legacy helper, re-used by backfill.

## Testing Strategy

- **Unit**: Scoring logic in `src/server/services/bank-interest/__tests__/interest-cleansing.scoring.test.ts`.
- **Integration**: tRPC endpoint and persistence logic in `src/server/trpc/__tests__/`.
- **Component**: Picker accessibility, keyboard navigation, and selection flow.
