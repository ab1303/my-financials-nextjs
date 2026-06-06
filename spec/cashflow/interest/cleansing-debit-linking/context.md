# Cleansing Donations — DEBIT Evidence Retrieval (Sub-phase Context)

## Purpose

This doc describes the DEBIT evidence retrieval sub-phase within the canonical interest-cleansing flow. It focuses on the ranked, fuzzy candidate picker API and UI that surface candidate DEBIT transactions for reviewer allocation. The picker provides a deterministic match percent, clear score breakdown, and account display to help reviewers confirm linkages.

## Current Implementation Summary

- Backend: `getCleansingDebitCandidates(params)` in `src/server/services/bank-interest/interest-cleansing.service.ts` returns a candidate list with minimal scoring fields (`score`, `scoreBreakdown`) computed from amount/date/description/account signals. The candidate selection fetch is now category-agnostic to improve recall.
- tRPC: `bankInterest.getCleansingDebitCandidates` forwards inputs (`creditId`, `bankAccountId`, `search`, `dateFrom`, `dateTo`, `limit`, `minScore`) and returns the service output.
- Frontend: `CleansingCandidatePicker.tsx` consumes the tRPC query and renders date/amount/description and a numeric `Score:`. It currently lacks a match badge, account display, detailed breakdown, keyboard interactions, and Confirm/selection UX.

## Boundaries & Constraints

- No Prisma schema or DB migration changes allowed.
- Changes are limited to service layer, tRPC router signatures, frontend picker UI, and tests.
- Maintain backwards compatibility for existing consumers where possible: added fields should be non-breaking.

## What implementers need (explicit)

1. Candidate DTO additions: `accountName`, `matchPercent`, `reasonLong`, and structured `scoreBreakdown` expressed as percent contributions.
2. Canonical weighting and normalization rules so frontends render deterministic badges and breakdowns.
3. Clear UI expectations: badge thresholds/colors, account dropdown semantics, search debounce (300ms), keyboard navigation, Confirm-button enablement, and no schema changes.
4. A small test plan (unit tests for scoring math; integration tests for the tRPC endpoint and the picker component) with exact assertions and file locations.

## Next Steps (implementation)

1. Run the Context Architect recommendations and update these spec docs to include the DTO contract and UI expectations (this file and LLD/HLD updated).
2. Update `getCleansingDebitCandidates` to return the augmented DTO and percent-based breakdowns.
3. Update `CleansingCandidatePicker.tsx` UI to show `matchPercent` badge, `accountName`, reason tooltip, account dropdown, and Confirm selection flow.
4. Add unit tests for scoring math and integration tests for the router and component.

## See also

- Domain HLD: [../hld.md](../hld.md)
- Interest cleansing LLD: [../interest-cleansing/lld.md](../interest-cleansing/lld.md)

## References

- Service implementation: `src/server/services/bank-interest/interest-cleansing.service.ts`
- Picker component: `src/app/(authorized)/cashflow/bank-interest/_components/CleansingCandidatePicker.tsx`

## UI Layout Recommendation

The existing drawer UI is constrained and can feel "squished" when the page contains many controls. To improve usability and clarity, prefer expanding the evidence-picker into the main content area (excluding the side nav) or promote it to its own route/page. Recommended behavior:

- Desktop: open picker as a full-width panel that occupies the main content column (same navigation context preserved). This provides space for the candidate list, detailed breakdown, account filter, and allocation controls without overlapping sidebars.
- Mobile / small screens: use a full-screen modal or drawer to preserve single-focus interactions.
- Progressive enhancement: keep a compact drawer as a feature-flagged fallback but default to the full main-area panel for wide viewports.

Rationale: More horizontal and vertical space lets reviewers scan match percents, see breakdowns, and use keyboard navigation comfortably. It also reduces visual clutter and the need for cramped typography.

Accessibility: ensure focus trapping, visible focus ring, Escape to close, and accessible labels for match badges and Confirm action.
