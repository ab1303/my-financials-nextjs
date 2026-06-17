# Cleansing Donations — DEBIT Evidence Retrieval (HLD)

## High-level solution

- **Service**: `getCleansingDebitCandidates()` computes match metrics. Linking is persisted via `InterestCleansingEvidence` (for interest) or direct linkage for other purposes.
- **tRPC**: `bankInterest.getCleansingDebitCandidates` returns ranked suggestions.
- **UI**: `CleansingCandidatePicker.tsx` renders match quality and account context.

## DTO — Candidate
```typescript
export type Candidate = {
  transactionId: string;
  matchPercent: number;
  reasonShort: string;
  // ... (breakdown fields)
};
```
