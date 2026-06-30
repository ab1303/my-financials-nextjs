## Executive Summary (orchestrator notes, 2026-06-30)

> **DECISION RESOLVED 2026-06-30 (re-decided):** Adopted **Option 3** — ADR features are
> tagged `status: "adr"` + `ownsConfidence: "none"`. This **supersedes** the earlier
> tactical "lock" of Option 1 (`ownsConfidence: "n/a-adr"`) applied via
> `scripts/apply-eadr.mjs`. Reasoning: `status` describes *what an entry is*;
> `ownsConfidence` describes *quality of ownership data*. The previous approach
> conflated the two. `'n/a-adr'` removed from the `ownsConfidence` enum;
> `'adr'` added to `statusValues`. `scripts/apply-eadr.mjs` deleted (one-off,
> superseded). `scripts/spec-check.mjs` updated to skip per-file detections
> (ghost / drift / review) for `status: 'adr'` entries. Applies to 3 features:
> `architecture.calendar-attribution`, `architecture.category-url-filtering`,
> `architecture.schema-naming`. Bucket B (P4) DDD backfill now unblocked.

After two rounds of regex tightening against manual spot-checks (5 samples per pass), the
classifier stabilised at these counts. Key takeaways for downstream phases:

- **Bucket C (planned) and D (dead) are empty.** Phases 1–2 of the plan are no-ops; the
  only real migration stub (`user-profile` root) was already retired in the previous
  session. All 72 features either map to real code or fall in B (live-but-undocumented).
- **Bucket B's signature:** short LLD (13–26 lines), Service-Contract table + sequence
  diagram, zero file references. Method names (e.g. `buildDedupSet()`, `getData()`)
  are the only handle for DDD agents to grep from. Heavier per-feature cost than A.
- **Bucket A signal quality is high.** 49 features have explicit file paths (`src/...`),
  File Inventory tables, or project-root references (`prisma/schema.prisma`,
  `playwright.config.ts`). Mechanical backfill viable.
- **Bucket E-adr is a decision needed before P3.** Two features (`calendar-attribution`,
  `category-url-filtering`) are ADRs / architectural standards. They legitimately own no
  feature-implementing code. `architecture.schema-naming` in Bucket B is likely a third
  ADR-style entry — flag for re-review.

### Decision needed before Phase 3

> **RESOLVED 2026-06-30:** Option 3 chosen (see Executive Summary banner above for
> rationale + supersession note). The options below are preserved for historical context.

How should ADR entries be represented in `spec/index.json`?

1. ~~Add `ownsConfidence: 'n/a-adr'` value (parallel to `n/a-planned`, leave `owns: []`).~~ *(initially applied, superseded)*
2. Remove ADR specs from `spec/index.json` entirely (they're not features); keep folder.
3. **✅ Mark them with `status: 'adr'` plus the standard `ownsConfidence: 'none'`.** *(chosen)*

### Revised execution path

| Phase | Status | Count | Notes |
|---|---|---:|---|
| P0 Discovery | ✅ done | 72 → A/B/E-adr | This worksheet |
| P1 Bucket D | ⏭ skipped | 0 | None remain |
| P2 Bucket C | ⏭ skipped | 0 | None detected |
| P3 Bucket A backfill | ⏳ ready | 49 | Per-domain sub-agent batches |
| P3.5 Bucket E-adr | ✅ done | 3 | Resolved via Option 3 (status:"adr") on 2026-06-30 |
| P4 Bucket B DDD | ⏳ ready | 21 | Heaviest phase; sequential |
| P5 Re-baseline | ⏳ blocked | — | After P3+P4 |

---

# spec/index.backfill-plan.md — Bucketing Worksheet

**Generated:** 2026-06-30
**Source manifest:** `spec/index.json` @ 568c61bc4aecb058bf50d45166346dd3ed9853ff
**Empty-owns features classified:** 72

## Buckets

| Bucket | Meaning | Action |
|---|---|---|
| **A** | Live + LLD lists files (src/ paths or File Inventory table) | Mechanical backfill via sub-agent |
| **B** | Live but undocumented (no file refs) | DDD-loop triage |
| **C** | Planned / not yet built | Set status:"planned", ownsConfidence:"n/a-planned" |
| **D** | Dead / migration stub | Delete folder + remove from index |
| **E-adr** | ADR / architectural standard (owns no code by design) | Mark with ownsConfidence:"n/a-adr" or similar — decision needed |

## Totals

| Bucket | Count |
|---|---:|
| A | 49 |
| B | 21 |
| E-adr | 2 |
| **All** | **72** |

## By Domain × Bucket

| Domain | A | B | C | D | E-adr | Total |
|---|---:|---:|---:|---:|---:|---:|
| ai-features | 3 | 0 | 0 | 0 | 0 | 3 |
| architecture | 7 | 1 | 0 | 0 | 2 | 10 |
| assets | 9 | 0 | 0 | 0 | 0 | 9 |
| banking | 4 | 0 | 0 | 0 | 0 | 4 |
| cashflow | 9 | 12 | 0 | 0 | 0 | 21 |
| csv-import | 6 | 0 | 0 | 0 | 0 | 6 |
| donations | 1 | 0 | 0 | 0 | 0 | 1 |
| phase2-scope | 1 | 0 | 0 | 0 | 0 | 1 |
| relation | 2 | 0 | 0 | 0 | 0 | 2 |
| settings | 3 | 0 | 0 | 0 | 0 | 3 |
| technical_debt | 3 | 0 | 0 | 0 | 0 | 3 |
| transactions | 1 | 8 | 0 | 0 | 0 | 9 |

## Bucket A (49)

| ID | Conf | LLD lines | src/ refs | File table | ADR | Migration | Planned | Reason |
|---|---|---:|---:|:-:|:-:|:-:|:-:|---|
| `ai-features.ai-image-import` | high | 32 | 12 |  |  |  |  | LLD lists files (srcLines=12, projectFileLines=2, fileInventoryTable=false) |
| `ai-features.ai-usage-logging` | high | 19 | 3 |  |  |  |  | LLD lists files (srcLines=3, projectFileLines=2, fileInventoryTable=false) |
| `ai-features.finance-chat` | high | 21 | 3 |  |  |  |  | LLD lists files (srcLines=3, projectFileLines=1, fileInventoryTable=false) |
| `architecture.design-modernization` | high | 617 | 29 |  |  |  | ✓ | LLD lists files (srcLines=29, projectFileLines=4, fileInventoryTable=false) |
| `architecture.development-standards` | high | 125 | 16 |  |  |  |  | LLD lists files (srcLines=16, projectFileLines=0, fileInventoryTable=false) |
| `architecture.e2e-testing` | medium | 159 | 0 |  |  |  |  | LLD lists files (srcLines=0, projectFileLines=4, fileInventoryTable=false) |
| `architecture.embedding-models` | high | 81 | 5 |  |  |  |  | LLD lists files (srcLines=5, projectFileLines=0, fileInventoryTable=false) |
| `architecture.entity-relations` | medium | 183 | 2 |  |  |  |  | LLD lists files (srcLines=2, projectFileLines=1, fileInventoryTable=false) |
| `architecture.preferred-currency` | high | 213 | 5 |  |  |  |  | LLD lists files (srcLines=5, projectFileLines=0, fileInventoryTable=false) |
| `architecture.site-audit` | high | 194 | 3 |  |  |  |  | LLD lists files (srcLines=3, projectFileLines=5, fileInventoryTable=false) |
| `assets.brokerage-cash-holdings` | high | 198 | 10 | ✓ |  |  |  | LLD lists files (srcLines=10, projectFileLines=3, fileInventoryTable=true) |
| `assets.invested-amount-display` | high | 185 | 4 |  |  |  |  | LLD lists files (srcLines=4, projectFileLines=0, fileInventoryTable=false) |
| `assets.overview-usd-conversion` | medium | 115 | 2 |  |  |  |  | LLD lists files (srcLines=2, projectFileLines=0, fileInventoryTable=false) |
| `assets.snapshot-display` | high | 161 | 4 |  |  |  |  | LLD lists files (srcLines=4, projectFileLines=0, fileInventoryTable=false) |
| `assets.snapshot-entry-redesign` | high | 724 | 16 |  |  |  |  | LLD lists files (srcLines=16, projectFileLines=0, fileInventoryTable=false) |
| `assets.snapshot-fx-rate` | high | 296 | 14 |  |  |  |  | LLD lists files (srcLines=14, projectFileLines=2, fileInventoryTable=false) |
| `assets.stock-market-segregation` | high | 306 | 4 |  |  |  |  | LLD lists files (srcLines=4, projectFileLines=0, fileInventoryTable=false) |
| `assets.stocks-tracking` | high | 140 | 9 |  |  |  |  | LLD lists files (srcLines=9, projectFileLines=0, fileInventoryTable=false) |
| `assets.zakat-stock-classification` | high | 519 | 27 |  |  |  |  | LLD lists files (srcLines=27, projectFileLines=0, fileInventoryTable=false) |
| `banking.bank-account-management` | high | 14 | 4 |  |  |  |  | LLD lists files (srcLines=4, projectFileLines=0, fileInventoryTable=false) |
| `banking.bank-institution-ui` | high | 14 | 4 |  |  |  |  | LLD lists files (srcLines=4, projectFileLines=0, fileInventoryTable=false) |
| `banking.brokerage-hybrid` | high | 14 | 4 |  |  |  |  | LLD lists files (srcLines=4, projectFileLines=0, fileInventoryTable=false) |
| `banking.business-institutions` | high | 14 | 4 |  |  |  |  | LLD lists files (srcLines=4, projectFileLines=0, fileInventoryTable=false) |
| `cashflow.categories.group-rollup` | high | 156 | 10 |  |  |  |  | LLD lists files (srcLines=10, projectFileLines=0, fileInventoryTable=false) |
| `cashflow.expense.manual-expense-transaction` | medium | 153 | 2 |  |  |  |  | LLD lists files (srcLines=2, projectFileLines=0, fileInventoryTable=false) |
| `cashflow.income.income-source-of-truth` | high | 362 | 10 |  |  |  |  | LLD lists files (srcLines=10, projectFileLines=1, fileInventoryTable=false) |
| `cashflow.income.income-ux-improvements` | high | 35 | 7 |  |  |  |  | LLD lists files (srcLines=7, projectFileLines=0, fileInventoryTable=false) |
| `cashflow.multi-account-transfer-integrity.add-filtration-parity` | high | 156 | 4 |  |  |  |  | LLD lists files (srcLines=4, projectFileLines=0, fileInventoryTable=false) |
| `cashflow.multi-account-transfer-integrity.fix-transfer-exclusion` | high | 196 | 12 |  |  |  |  | LLD lists files (srcLines=12, projectFileLines=0, fileInventoryTable=false) |
| `cashflow.multi-account-transfer-integrity.handle-orphans` | high | 372 | 14 |  |  |  |  | LLD lists files (srcLines=14, projectFileLines=2, fileInventoryTable=false) |
| `cashflow.multi-account-transfer-integrity.harden-import-wizard` | medium | 213 | 1 |  |  |  |  | LLD lists files (srcLines=1, projectFileLines=0, fileInventoryTable=false) |
| `cashflow.multi-account-transfer-integrity.improve-detection` | high | 148 | 3 |  |  |  |  | LLD lists files (srcLines=3, projectFileLines=0, fileInventoryTable=false) |
| `csv-import.batch-re-matching` | high | 73 | 7 |  |  |  |  | LLD lists files (srcLines=7, projectFileLines=1, fileInventoryTable=false) |
| `csv-import.generic-csv-import` | high | 75 | 9 |  |  |  |  | LLD lists files (srcLines=9, projectFileLines=0, fileInventoryTable=false) |
| `csv-import.llm-classification` | high | 86 | 6 |  |  |  |  | LLD lists files (srcLines=6, projectFileLines=1, fileInventoryTable=false) |
| `csv-import.rag-examples` | high | 60 | 6 |  |  |  |  | LLD lists files (srcLines=6, projectFileLines=2, fileInventoryTable=false) |
| `csv-import.semantic-matching` | high | 212 | 8 |  |  |  |  | LLD lists files (srcLines=8, projectFileLines=1, fileInventoryTable=false) |
| `csv-import.session-date-range` | high | 52 | 4 |  |  |  |  | LLD lists files (srcLines=4, projectFileLines=2, fileInventoryTable=false) |
| `donations.donation-domain-boundary-refactor` | high | 123 | 8 |  |  |  | ✓ | LLD lists files (srcLines=8, projectFileLines=0, fileInventoryTable=false) |
| `phase2-scope.home-dashboard-widgets` | high | 127 | 10 | ✓ |  |  |  | LLD lists files (srcLines=10, projectFileLines=0, fileInventoryTable=true) |
| `relation.business-contacts` | high | 84 | 7 | ✓ |  |  |  | LLD lists files (srcLines=7, projectFileLines=0, fileInventoryTable=true) |
| `relation.individual-contacts` | high | 91 | 5 | ✓ |  |  |  | LLD lists files (srcLines=5, projectFileLines=0, fileInventoryTable=true) |
| `settings.calendar-management` | high | 57 | 0 | ✓ |  |  |  | LLD lists files (srcLines=0, projectFileLines=0, fileInventoryTable=true) |
| `settings.category-management` | high | 70 | 0 | ✓ |  |  |  | LLD lists files (srcLines=0, projectFileLines=0, fileInventoryTable=true) |
| `settings.profile-settings` | high | 51 | 0 | ✓ |  |  |  | LLD lists files (srcLines=0, projectFileLines=0, fileInventoryTable=true) |
| `technical_debt.duplicate-review-tab` | high | 82 | 4 |  |  |  |  | LLD lists files (srcLines=4, projectFileLines=0, fileInventoryTable=false) |
| `technical_debt.preapply-category-rules` | high | 110 | 4 |  |  |  |  | LLD lists files (srcLines=4, projectFileLines=0, fileInventoryTable=false) |
| `technical_debt.remove-denormalized-monthly-expense-summary` | high | 66 | 6 |  |  |  |  | LLD lists files (srcLines=6, projectFileLines=0, fileInventoryTable=false) |
| `transactions.transaction-bulk-apply` | high | 51 | 7 |  |  |  |  | LLD lists files (srcLines=7, projectFileLines=0, fileInventoryTable=false) |

## Bucket B (21)

| ID | Conf | LLD lines | src/ refs | File table | ADR | Migration | Planned | Reason |
|---|---|---:|---:|:-:|:-:|:-:|:-:|---|
| `architecture.schema-naming` | medium | 203 | 0 |  |  |  |  | No file refs but LLD is substantive (203 lines) — needs DDD |
| `cashflow.analytics-dashboard` | medium | 26 | 0 |  |  |  |  | No file refs but LLD is substantive (26 lines) — needs DDD |
| `cashflow.audit.cashflow-audit` | medium | 21 | 0 |  |  |  |  | Short LLD (21 lines), no file refs — likely live but undocumented |
| `cashflow.bank-account-filter-parity` | medium | 21 | 0 |  |  |  |  | Short LLD (21 lines), no file refs — likely live but undocumented |
| `cashflow.categories.category-management` | medium | 22 | 0 |  |  |  |  | Short LLD (22 lines), no file refs — likely live but undocumented |
| `cashflow.categories.drill-down` | medium | 23 | 0 |  |  |  |  | Short LLD (23 lines), no file refs — likely live but undocumented |
| `cashflow.contextual-account-tracking` | medium | 21 | 0 |  |  |  |  | Short LLD (21 lines), no file refs — likely live but undocumented |
| `cashflow.donations.transaction-linking` | medium | 26 | 0 |  |  |  |  | No file refs but LLD is substantive (26 lines) — needs DDD |
| `cashflow.expense.expense-tracking` | medium | 25 | 0 |  |  |  |  | No file refs but LLD is substantive (25 lines) — needs DDD |
| `cashflow.income.income-management` | medium | 22 | 0 |  |  |  |  | Short LLD (22 lines), no file refs — likely live but undocumented |
| `cashflow.interest.cleansing-debit-linking` | medium | 13 | 0 |  |  |  |  | Short LLD (13 lines), no file refs — likely live but undocumented |
| `cashflow.multi-account-transfer-integrity` | medium | 25 | 0 |  |  |  |  | No file refs but LLD is substantive (25 lines) — needs DDD |
| `cashflow.transfer-resolution-improvements` | medium | 22 | 0 |  |  |  |  | Short LLD (22 lines), no file refs — likely live but undocumented |
| `transactions.import-audit-trail` | medium | 24 | 0 |  |  |  |  | Short LLD (24 lines), no file refs — likely live but undocumented |
| `transactions.paginated-search` | medium | 59 | 0 |  |  |  |  | No file refs but LLD is substantive (59 lines) — needs DDD |
| `transactions.transaction-dedup` | medium | 23 | 0 |  |  |  |  | Short LLD (23 lines), no file refs — likely live but undocumented |
| `transactions.transaction-enrichment` | medium | 22 | 0 |  |  |  |  | Short LLD (22 lines), no file refs — likely live but undocumented |
| `transactions.transfer-counterpart` | medium | 15 | 0 |  |  |  |  | Short LLD (15 lines), no file refs — likely live but undocumented |
| `transactions.transfer-match-rules` | medium | 22 | 0 |  |  |  |  | Short LLD (22 lines), no file refs — likely live but undocumented |
| `transactions.transfer-reconciliation` | medium | 25 | 0 |  |  |  |  | No file refs but LLD is substantive (25 lines) — needs DDD |
| `transactions.undo-safeguards` | medium | 25 | 0 |  |  |  |  | No file refs but LLD is substantive (25 lines) — needs DDD |

## Bucket E-adr (2)

| ID | Conf | LLD lines | src/ refs | File table | ADR | Migration | Planned | Reason |
|---|---|---:|---:|:-:|:-:|:-:|:-:|---|
| `architecture.calendar-attribution` | high | 174 | 0 |  | ✓ |  |  | ADR / architectural standard — owns no code by design |
| `architecture.category-url-filtering` | high | 234 | 2 |  | ✓ |  |  | ADR / architectural standard — owns no code by design |
