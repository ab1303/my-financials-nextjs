Low-Level Design: Interest Cleansing

Summary

This LLD is the canonical implementation plan for interest-cleansing linkage semantics and includes DB schema additions, migration plan, server API and tRPC changes, fuzzy-match algorithm, UI/UX wireframes and interactions, tests, and a phase map for implementing M:N linking between credit interest transactions and donation DEBIT evidence transactions.

1. Data model changes

Prisma schema additions (prisma/schema.prisma excerpt):

model DonationPaymentEvidence {
id String @id @default(cuid())
donationPaymentId String
evidenceTransactionId String
amountApplied Decimal @db.Decimal(18,2)
confidence Float? @default(0.0)
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt

DonationPayment DonationPayment @relation(fields: [donationPaymentId], references: [id], onDelete: Cascade)
EvidenceTransaction Transaction @relation(fields: [evidenceTransactionId], references: [id], onDelete: Cascade)

@@index([donationPaymentId])
@@index([evidenceTransactionId])
@@unique([donationPaymentId, evidenceTransactionId])
}

Notes:

- Decimal used for precise monetary allocations. amountApplied represents how much of the donation/evidence is applied to the credit.
- We keep a "confidence" float to store fuzzy-match score when backfilled/suggested.
- The DB-level unique constraint prevents duplicate identical allocations. Multiple distinct allocations between same pair are not expected; if needed, use separate rows with different timestamps (but current design enforces uniqueness to simplify accounting).

2. Migration plan summary

High-level steps:

- Add DonationPaymentEvidence model to prisma/schema.prisma.
- Create migration: pnpm prisma migrate dev --name add-donation-payment-evidence (follow safety rules: stop dev server first).
- Deploy migration to staging and run backfill script (see Backfill).
- Add DB indexes and analyze performance.

3. Server API & tRPC changes

New tRPC routers / server endpoints:

- POST /trpc/interest.suggestAllocations
  - Input: { creditId: string, limit?: number }
  - Output: [{ evidenceId, evidenceAmount, score, suggestedAmount }]
  - Behavior: Run fuzzy-match on server and return ranked suggestions.

- POST /trpc/interest.applyAllocations
  - Input: { creditId: string, allocations: [{ evidenceId, amount }] }
  - Output: { success: boolean, allocationsCreated: number }
  - Behavior: Validate amounts (sum <= credit.remaining, amount <= evidence.remaining), create DonationPaymentEvidence rows, recalc remaining amounts atomically in a DB transaction, emit domain events/audit log.

- DELETE /trpc/interest.removeAllocation
  - Input: { allocationId }
  - Output: { success }
  - Behavior: Soft-delete or fully delete allocation depending on audit policy. Prefer marking with deletedAt and recording removedBy/removalReason in a separate audit table.

Server-side validations:

- Enforce strict decimal precision and non-negative amounts.
- Check for race conditions: apply allocations inside serializable transaction or with SELECT FOR UPDATE on involved rows (transactions/donations) to avoid over-allocation.

4. Fuzzy-match algorithm

Design goals: maximize recall of true matches while minimizing false positives. Provide confidence score for UI to present. Suggested thresholds: >=0.85 auto-apply in backfill, 0.60-0.85 reviewer-suggested, <0.60 omitted.

Candidate selection

- Filter candidate DEBITs by: same bank account (if available), date window (credit.date +/- 90 days default), amount within factor (e.g., +/- 50%), DEBIT direction, not already fully allocated.

Scoring factors (normalized, weighted):

- Amount proximity (weight 0.40): 1 - (abs(credit.amount - evidence.amount) / max(credit.amount, evidence.amount))
- Date proximity (weight 0.20): 1 - (days_between / 90) clipped to [0,1]
- Description similarity (weight 0.20): token-set ratio (fuzzy token overlap) between descriptions
- Donor/payment reference match (weight 0.15): exact substring / identifier match (payment ID, donor id)
- Historical linkage (weight 0.05): if existing allocations historically linked similar patterns

Score = weighted sum. Suggested thresholds:

- > = 0.85: auto-apply in backfill (high confidence)
- 0.60 - 0.85: suggested to human reviewer
- < 0.60: omit from suggestions

Partial allocation rule

- If evidence.amount > credit.remaining, suggestedAmount = credit.remaining and mark evidence.remaining = evidence.amount - suggestedAmount.
- If evidence.amount < credit.remaining, suggestedAmount = evidence.amount.

5. UI / UX changes

Components impacted

- Credit detail page (Interest transaction view) — add "Evidence" panel
- Donation / Payment detail page — show list of credits this evidence participates in
- Bulk Reconciliation page (Operations) — list unmatched credits with "Auto-suggest" button and multi-select evidence picker

Evidence picker UX

- Multi-select list of candidate Evidence DEBITs with:
  - checkbox to select
  - evidence.amount, evidence.remaining
  - input for allocation amount (default = min(evidence.remaining, credit.remaining distributed proportionally)
  - confidence score (if coming from suggestion)
- Client must validate sum of entered allocations <= credit.remaining
- Provide quick actions: "Auto-suggest" (runs server fuzzy-match), "Apply all suggested", "Clear".

Partial amounts

- Deposit allocation input supports decimal input and step configured by currency minor unit (0.01).
- Show remaining amounts after allocation in UI.

Acceptance flow

- User opens a Credit -> clicks "Allocate Evidence" -> sees auto-suggestions + multi-select.
- User toggles evidence and adjusts amounts -> clicks "Apply" -> client calls applyAllocations API -> shows success and updated remaining amounts.

Audit & history

- Show allocation rows with createdAt, createdBy, confidence, and link to evidence transaction.
- Provide CSV export of allocations for a given date range.

6. Tests

Unit tests

- Fuzzy-match scoring:
  - exact amount/date/description yields score >= 0.95
  - different amounts/dates produce lower scores
- Allocation validation logic:
  - applying allocations that sum > credit.remaining fails
  - applying amounts > evidence.remaining fails

Integration tests

- API applyAllocations creates DonationPaymentEvidence rows and adjusts remaining amounts transactionally.
- Backfill script idempotency: re-running backfill does not duplicate allocations.

End-to-end tests

- UI flow: Auto-suggest -> user accept -> allocations applied and UI updates remaining balances.
- Partial allocation scenarios (one large evidence split across two credits; one credit filled by multiple evidences).

Test data fixtures

- credit-1: amount 100.00 date 2025-02-01
- evidence-a: donation 60.00 date 2025-01-20
- evidence-b: donation 50.00 date 2025-02-10
- Expected: backfill suggests evidence-a (60) + evidence-b (40) to cover credit-1 with confidence scores reflecting date and amount proximity.

7. Phase map (matching previous LLD phases)

Phase A: Design & schema (this doc)
Phase B: DB migration + prisma model + migration SQL (safe-deploy)
Phase C: Backfill tooling (standalone script) + staging run
Phase D: Server API/tRPC endpoints + unit tests
Phase E: UI components (Evidence picker, Credit detail additions) + E2E tests
Phase F: Documentation, export, deployment to production + monitoring

Order & dependencies

- B before C (migrations before backfill)
- C on staging before enabling UI in production
- D required for E

Estimated timeboxes

- Phase B: 1 day
- Phase C: 1-2 days (backfill tuning)
- Phase D: 1 day
- Phase E: 2 days
- Phase F: 0.5 day

8. Acceptance criteria

- DB contains DonationPaymentEvidence model and migration applied in staging.
- Backfill creates allocations automatically only when score >= 0.85 and writes suggestions for 0.6-0.85.
- UI supports multi-select evidence picker with partial allocation edits.
- API validates transactional integrity and prevents over-allocation.
- Tests cover fuzzy-match, apply/remove allocations, and end-to-end user flows.

9. Open questions / Future improvements

- Should allocations be soft-deletable with a removal audit record? (Recommend yes.)
- Should we track currency and FX adjustments for cross-currency allocations? (Out of scope now.)
- Consider adding machine-learning-based matching later if fuzzy-match proves insufficient.

Appendix: SQL example for idempotent insert (Postgres):

INSERT INTO DonationPaymentEvidence (id, donationPaymentId, evidenceTransactionId, amountApplied, confidence, createdAt)
SELECT gen_random_uuid(), $1, $2, $3, $4, now()
WHERE NOT EXISTS (
SELECT 1 FROM DonationPaymentEvidence WHERE donationPaymentId = $1 AND evidenceTransactionId = $2
);
