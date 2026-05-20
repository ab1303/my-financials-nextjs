# Cashflow Audit — Low Level Design

## Audit Artifact Structure
The migrated audit remains a report-style feature spec with four layers of detail:

1. **Coverage table** — routes audited and page titles validated.
2. **Issue taxonomy** — `BUG`, `SSR`, `A11Y`, `META`, and `DM` identifiers.
3. **Page-by-page findings** — load status, CRUD status, validation behavior, and rendering notes.
4. **Affected-file inventory** — implementation files tied to each finding or fix.

## Coverage

| Route | Focus | Result |
|---|---|---|
| `/cashflow/income` | Fiscal-year selection, inline CRUD, SSR boundary | CRUD mostly works; race-condition + SSR follow-up documented |
| `/cashflow/donations` | Fiscal-year filter, inline CRUD, validation messages | Fully working during audit |
| `/cashflow/expense` | Month table, category breakdown modal, SSR, accessibility | CRUD working; SSR fallback documented; accessibility fix verified |
| `/cashflow/bank-interest` | Bank/year filtering, payment history modal | Working within test-data limits |

## Finding Groups Captured by the Audit

### Open Follow-Up Items
- **BUG-01** — Income `Add Entry` race condition while fiscal-year URL params are still converging.
- **SSR-01** — Income form re-instantiation during SSR, causing client fallback.
- **SSR-02** — Expense page tree reaches tRPC without provider context during SSR.

### Verified Fixes
- **A11Y-01** — Expense loading modal now includes a `DialogTitle`.
- **META-01** — Donations page now exports route metadata.
- **DM-01`…`DM-08** — dark-mode regressions across fiscal-year selects, table cells, modal cards, and donations page styling were resolved.

## Evidence Rules

- Every finding should name the exact route and the user-visible impact.
- File-level remediation targets belong in this document, not in `context.md`.
- Fix status is allowed here because the audit is both a quality record and a maintenance handoff.

## File Inventory

| File | Purpose in the audit |
|---|---|
| `src/app/(authorized)/cashflow/income/form.tsx` | Fiscal-year auto-selection and SSR follow-up target |
| `src/app/(authorized)/cashflow/donations/page.tsx` | Metadata and label-color findings |
| `src/app/(authorized)/cashflow/donations/DonationTableClient.tsx` | Donations heading, loading-state, and action-button styling |
| `src/app/(authorized)/cashflow/expense/form.tsx` | Expense fiscal-year select styling |
| `src/app/(authorized)/cashflow/expense/_components/CategoryBreakdownModal.tsx` | Accessibility and dark-mode remediation |
| `src/app/(authorized)/cashflow/bank-interest/_components/PaymentHistoryModal.tsx` | Dark-mode card styling audit |
| `src/components/react-table/TableCell.tsx` | Shared inline-select dark-mode fix target |
| `src/lib/select-styles.ts` | Shared compact select styling utility added during remediation |

## Historical Summary Preserved
The original audit established that the cashflow surface had no page-load failures, documented one meaningful product bug, and verified that the remaining visible defects were styling, metadata, or accessibility issues rather than broken CRUD flows. That distinction is preserved here so future audits can separate product correctness from presentation regressions.

## Migration Note
This feature consolidates the deleted flat cashflow audit report into the cashflow domain structure; the route findings and remediation targets above are the canonical record.
