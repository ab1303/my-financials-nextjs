Canonical architecture source for interest-cleansing linkage UX: interest-cleansing spec set (context/hld/lld) as single source of truth for flow semantics, matching logic, allocation model, and acceptance criteria.
Canonical linkage model: CREDIT interest transaction selection as anchor entity, followed by DEBIT evidence transaction selection and allocation application.
Canonical relationship model: M:N linkage between credits and evidence debits with partial allocations; one credit can map to multiple evidence debits and one evidence debit can contribute across credits.
Canonical matching strategy: server-side fuzzy suggestion pipeline with confidence scoring, reviewer acceptance/adjustment, and threshold-based handling (high-confidence auto-apply in backfill, medium-confidence reviewer queue, low-confidence omit).
Canonical UX pattern: evidence picker with ranked candidates, confidence visibility, selectable rows, editable allocation amounts, and validation that allocated sum does not exceed credit remaining.
Canonical operational flow: select credit -> fetch/rank debit evidence -> adjust allocations -> apply allocations transactionally -> refresh remaining balances/audit trail.
Existing implementation divergence identified: current drawer path links via credit-oriented transaction selection instead of completing debit-evidence allocation workflow.
Existing spec divergence identified: UI-fixes slice prescribes credit-only drawer behavior; debit-linking slice prescribes debit-only linking semantics; both conflict with canonical two-step credit-anchor + debit-evidence M:N model.
Category semantics decision: eligibility must not depend on hardcoded category literals; category name must be configurable/rename-safe to avoid workflow breakage after admin renames.
Referential integrity decision (category sync): transaction category remains string-backed; rename operations must synchronize affected transaction rows to preserve linkage discoverability.
Documentation cleanup decision: non-canonical interest sub-specs should be narrowed to their local concerns and explicitly defer linkage UX/matching/allocation semantics to the canonical interest-cleansing spec.
Documentation cleanup scope:
Remove or neutralize credit-only linkage prescriptions in UI-fixes docs.
Reframe debit-linking docs as sub-phase for evidence candidate retrieval within canonical two-step flow.
Remove one-to-one linkage assumptions from debit-linking docs.
Replace hardcoded “Bank Interest” eligibility wording with configurable category reference aligned to category-sync rules.
Product-level UX direction agreed: transaction-ledger-style linkage ergonomics for evidence selection (search + fuzzy-ranked candidates + confidence signal), adapted to interest-cleansing allocation workflow.
Technical intent for API contracts: suggestion/apply/remove endpoints should operate on allocation semantics and evidence candidates, not shortcut single-field linkage semantics.
Technical acceptance direction: preserve auditability (allocation metadata + confidence provenance), transactional integrity for apply operations, and test coverage across fuzzy scoring, over-allocation guards, partial allocation scenarios, and end-to-end reviewer flow.
