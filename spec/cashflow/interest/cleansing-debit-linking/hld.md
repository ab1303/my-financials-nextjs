# Cleansing Donations — DEBIT Evidence Retrieval (Sub-phase HLD)

## Purpose

Upgrade the existing DEBIT-candidate endpoint and picker UI to a fuzzy candidate picker UX that returns a deterministic `matchPercent`, a multi-field `scoreBreakdown` expressed as percent contributions, `accountName` display, and `reasonLong` explanation text. The goal is to present ranked candidates to reviewers with clear rationale so they can confidently Confirm linking evidence.

## High-level solution

- Service: extend `getCleansingDebitCandidates` to compute and return the DTO fields required by the UI (see LLD for exact DTO). Keep the candidate-selection data source unchanged (CONFIRMED, unlinked DEBITs filtered by configured category and optional `bankAccountId`).
- tRPC: keep the same query but update returned typing and Zod documentation. Preserve inputs: `creditId`, `bankAccountId`, `search`, `dateFrom`, `dateTo`, `limit`, `minScore` (minScore is 0–100 percent).
- UI: replace the simple list with the fuzzy-picker UX in `CleansingCandidatePicker.tsx`:
  - Show an inline `matchPercent` badge next to each candidate.
  - Show `accountName` in an inline account dropdown (if multiple accounts are present for the search scope).
  - Show a short `reasonShort` inline and `reasonLong` in a hover tooltip or expandable row (reasonLong delivered by server).
  - Support search with 300ms debounce; server `search` filters by description tokens and numeric amount match (LLD: tokenization behavior).
  - Keyboard navigation: ArrowUp/ArrowDown to move focus; Enter selects candidate; Esc clears selection/ closes picker.
  - A Confirm button must be present and enabled only when an explicit candidate is selected.

## DTO — canonical Candidate (summary)

- The LLD contains the full TypeScript DTO; implementers must follow it precisely. Important highlights:
  - `matchPercent: number` is the canonical 0–100 integer used by the UI badge.
  - `scoreBreakdown` exposes both normalized raw scores (0..1) and integer contribution percents that sum to `matchPercent`.
  - `accountName` must be returned so the frontend can render a human-friendly account label without additional lookups.

## Success Criteria

- Users can link DEBIT transactions as evidence for cleansing donations using the fuzzy picker UX.
- Each candidate shows a clear match percent and an explainable breakdown that aligns with the server's score computation.
- The picker supports account-scoped and cross-account searches and is accessible via keyboard.

## Out of Scope

- Database schema changes.
- Rewriting existing allocation flows (`suggestAllocations` remains unchanged).

## UI Layout & Placement

The current drawer can appear cramped when the page contains many controls. Two supported options are:

- Full main-area panel (recommended): render the picker as a full-width panel occupying the main content column (side nav preserved). This provides the most space for list, breakdown, filters, and allocation controls while keeping the user in the same navigation context.
- Dedicated route/page: `/cashflow/bank-interest/cleanse/[creditId]` — navigates to a focused page for reviewing and confirming allocations. This is appropriate if the workflow requires deep context or additional related controls.

Recommendation: prefer the Full main-area panel for faster iteration and minimal navigation changes, with the following adaptive behavior:

- Desktop: main-area panel (default)
- Mobile: full-screen modal/drawer

Rationale: the main-area panel preserves context (user remains on the same feature page) and gives ample space to render match percentages, breakdown charts, and keyboard interactions without the cramped layout of a small drawer.

## References

- Domain HLD: [../hld.md](../hld.md)
- Interest cleansing LLD: [../interest-cleansing/lld.md](../interest-cleansing/lld.md)
