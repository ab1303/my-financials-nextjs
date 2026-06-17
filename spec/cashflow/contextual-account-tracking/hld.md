# Contextual Account Tracking — High-Level Design (HLD)

## Problem & Proposed Solution

Today, the "Tracked" toggle in the Bank Accounts table is confusing and lacks context. Users unfamiliar with YNAB's "off-budget" concept see a toggle with no explanation, leading to misuse and misunderstanding. The toggle appears for all users, regardless of whether they need it, and offers no guidance on its impact on transfer matching or reports.

**Proposed solution:** Remove the standalone "Tracked" column from the main accounts table. Instead, surface the `isTracked` flag only when contextually relevant: (1) as a 4th resolution button in the OrphanResolutionPanel for orphaned transfers, and (2) in a collapsed "Advanced" section at the bottom of the Bank Accounts page, with clear explanatory copy.

## Architecture Decisions

1. **Contextual surfacing only** — `isTracked` is shown only in advanced or transfer resolution contexts, not by default. *Rationale: Reduces confusion for new users.*
2. **No schema changes** — The `isTracked` field remains as-is in the Prisma model. *Rationale: Avoids unnecessary migrations; leverages existing logic.*
3. **Extend OrphanResolutionPanel** — Add a 4th button to set `isTracked=false` on the counterpart account and resolve as EXCLUDED. *Rationale: Surfaces the concept only when the user encounters an orphaned transfer.*
4. **Advanced section for power users** — Add a collapsible section at the bottom of the Bank Accounts page for manual control. *Rationale: Keeps the main UI simple, but allows advanced users to manage tracking.*
5. **Plain language copy** — All UI copy avoids jargon like "off-budget"; uses clear explanations. *Rationale: Improves user understanding and reduces support burden.*

## Component/UI Changes
- Remove "Tracked" column from Bank Accounts table
- Add collapsible "Advanced" section with `isTracked` toggle and explanation
- Add 4th resolution button to OrphanResolutionPanel for orphaned transfers

## Success Criteria
- "Tracked" column is no longer visible in the main Bank Accounts table
- Advanced section is hidden by default and contains clear explanation and toggle
- OrphanResolutionPanel offers a 4th button: "The other account is never imported"
- Clicking the 4th button sets `isTracked=false` on the counterpart and resolves orphan as EXCLUDED
- All copy uses plain language; no "off-budget" jargon
- No new Prisma migration is required

## Out of Scope / Future Phases
| Item | Rationale |
|------|-----------|
| Counterpart detection for ambiguous or missing accounts | Requires improved transfer matching logic |
| Undo/redo history for tracking changes | Out of scope for MVP |
| User education modal or onboarding for account tracking | Future UX enhancement |
