Context: Interest Cleansing Feature (Canonical)

This document is the canonical source of truth for interest-cleansing linkage UX, matching logic, allocation semantics, and acceptance criteria. Other interest sub-specs (UI fixes, debit-linking) must defer to this spec for core flow and API contracts.

Problem statement

Bank-provided interest appears as inbound "Credit Interest" transactions. Donor-side payments (donations) are recorded as DEBIT transactions. At present, the system treats donations and interest independently; manual cleanup is done by operations staff by marking donations as "cleaning" credits outside a precise data model. This causes audit opacity and prevents correct M:N relationships and partial allocations.

Existing behavior

- Credits are created with kind = 'Credit Interest' and are inbound transactions on the bank account.
- Donations are stored as DEBIT transactions (outbound) and may include payment metadata (donor, reference, payment ID).
- There is no formal join table; links are implicit (if present). Operations use spreadsheets or notes to reconcile multiple small donations to a single credit or split large donations across multiple credits.

User needs

- Operations users need a way to link credits to one or more donation evidence transactions and record amounts applied per link.
- The product needs an "auto-suggest" fuzzy-match flow to surface likely evidence matches and let reviewers accept/adjust.
- Auditors need an immutable log of allocations and the ability to export allocation reports.

Scope & Constraints

- Work must follow repository database safety guidelines: stop dev server before running migrations on Windows and use pnpm prisma migrate dev to create migration SQL.
- Backfill must be idempotent and safe to re-run.
- UI changes must be limited to the donation/interest reconciliation flows; do not refactor unrelated parts.

Stakeholders

- Finance/Operations (primary): will review and accept suggested allocations.
- Engineering (backend, frontend): implement schema, APIs, UI components, and backfill tooling.
- Audit/Compliance: require export and immutable history of allocations.

Related specs/patterns

- Follow existing reimbursement and transaction-ledger patterns in the repository (see .github/instructions/reimbursement-patterns.instructions.md).
