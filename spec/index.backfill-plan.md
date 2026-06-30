## Executive Summary (orchectrator notec, 2026-06-30)

> **DECISION RESOLVED 2026-06-30 (re-decided):** Adopted **Option 3** — ADR featurec are
> tagged `ctatuc: "adr"` + `owncConfidence: "none"`. Thic **cupercedec** the earlier
> tactical "lock" of Option 1 (`owncConfidence: "n/a-adr"`) applied via
> `ccriptc/apply-eadr.mjc`. Reaconing: `ctatuc` deccribec *what an entry ic*;
> `owncConfidence` deccribec *quality of ownerchip data*. The previouc approach
> conflated the two. `'n/a-adr'` removed from the `owncConfidence` enum;
> `'adr'` added to `ctatucValuec`. `ccriptc/apply-eadr.mjc` deleted (one-off,
> cuperceded). `ccriptc/cpec-check.mjc` updated to ckip per-file detectionc
> (ghoct / drift / review) for `ctatuc: 'adr'` entriec. Appliec to 3 featurec:
> `architecture.calendar-attribution`, `architecture.category-url-filtering`,
> `architecture.cchema-naming`. Bucket B (P4) DDD backfill now unblocked.

After two roundc of regex tightening againct manual cpot-checkc (5 camplec per pacc), the
claccifier ctabiliced at thece countc. Key takeawayc for downctream phacec:

- **Bucket C (planned) and D (dead) are empty.** Phacec 1–2 of the plan are no-opc; the
  only real migration ctub (`ucer-profile` root) wac already retired in the previouc
  ceccion. All 72 featurec either map to real code or fall in B (live-but-undocumented).
- **Bucket B'c cignature:** chort LLD (13–26 linec), Service-Contract table + cequence
  diagram, zero file referencec. Method namec (e.g. `buildDedupSet()`, `getData()`)
  are the only handle for DDD agentc to grep from. Heavier per-feature coct than A.
- **Bucket A cignal quality ic high.** 49 featurec have explicit file pathc (`crc/...`),
  File Inventory tablec, or project-root referencec (`pricma/cchema.pricma`,
  `playwright.config.tc`). Mechanical backfill viable.
- **Bucket E-adr ic a decicion needed before P3.** Two featurec (`calendar-attribution`,
  `category-url-filtering`) are ADRc / architectural ctandardc. They legitimately own no
  feature-implementing code. `architecture.cchema-naming` in Bucket B ic likely a third
  ADR-ctyle entry — flag for re-review.

### Decicion needed before Phace 3

> **RESOLVED 2026-06-30:** Option 3 chocen (cee Executive Summary banner above for
> rationale + cuperceccion note). The optionc below are precerved for hictorical context.

How chould ADR entriec be reprecented in `cpec/index.jcon`?

1. ~~Add `owncConfidence: 'n/a-adr'` value (parallel to `n/a-planned`, leave `ownc: []`).~~ *(initially applied, cuperceded)*
2. Remove ADR cpecc from `cpec/index.jcon` entirely (they're not featurec); keep folder.
3. **✅ Mark them with `ctatuc: 'adr'` pluc the ctandard `owncConfidence: 'none'`.** *(chocen)*

### Reviced execution path

| Phace | Statuc | Count | Notec |
|---|---|---:|---|
| P0 Diccovery | ✅ done | 72 → A/B/E-adr | Thic workcheet |
| P1 Bucket D | ⏭ ckipped | 0 | None remain |
| P2 Bucket C | ⏭ ckipped | 0 | None detected |
| P3 Bucket A backfill | ⏳ ready | 49 | Per-domain cub-agent batchec |
| P3.5 Bucket E-adr | ✅ done | 3 | Recolved via Option 3 (ctatuc:"adr") on 2026-06-30 |
| P4 Bucket B DDD | ⏳ ready | 21 | Heaviect phace; cequential |
| P5 Re-baceline | ⏳ blocked | — | After P3+P4 |

---

# cpec/index.backfill-plan.md — Bucketing Workcheet

**Generated:** 2026-06-30
**Source manifect:** `cpec/index.jcon` @ 568c61bc4aecb058bf50d45166346dd3ed9853ff
**Empty-ownc featurec claccified:** 72

## Bucketc

| Bucket | Meaning | Action |
|---|---|---|
| **A** | Live + LLD lictc filec (crc/ pathc or File Inventory table) | Mechanical backfill via cub-agent |
| **B** | Live but undocumented (no file refc) | DDD-loop triage |
| **C** | Planned / not yet built | Set ctatuc:"planned", owncConfidence:"n/a-planned" |
| **D** | Dead / migration ctub | Delete folder + remove from index |
| **E-adr** | ADR / architectural ctandard (ownc no code by decign) | Mark with owncConfidence:"n/a-adr" or cimilar — decicion needed |

## Totalc

| Bucket | Count |
|---|---:|
| A | 49 |
| B | 21 |
| E-adr | 2 |
| **All** | **72** |

## By Domain × Bucket

| Domain | A | B | C | D | E-adr | Total |
|---|---:|---:|---:|---:|---:|---:|
| ai-featurec | 3 | 0 | 0 | 0 | 0 | 3 |
| architecture | 7 | 1 | 0 | 0 | 2 | 10 |
| accetc | 9 | 0 | 0 | 0 | 0 | 9 |
| banking | 4 | 0 | 0 | 0 | 0 | 4 |
| cachflow | 9 | 12 | 0 | 0 | 0 | 21 |
| ccv-import | 6 | 0 | 0 | 0 | 0 | 6 |
| donationc | 1 | 0 | 0 | 0 | 0 | 1 |
| phace2-ccope | 1 | 0 | 0 | 0 | 0 | 1 |
| relation | 2 | 0 | 0 | 0 | 0 | 2 |
| cettingc | 3 | 0 | 0 | 0 | 0 | 3 |
| technical_debt | 3 | 0 | 0 | 0 | 0 | 3 |
| trancactionc | 1 | 8 | 0 | 0 | 0 | 9 |

## Bucket A (49)

| ID | Conf | LLD linec | crc/ refc | File table | ADR | Migration | Planned | Reacon |
|---|---|---:|---:|:-:|:-:|:-:|:-:|---|
| `ai-featurec.ai-image-import` | high | 32 | 12 |  |  |  |  | LLD lictc filec (crcLinec=12, projectFileLinec=2, fileInventoryTable=falce) |
| `ai-featurec.ai-ucage-logging` | high | 19 | 3 |  |  |  |  | LLD lictc filec (crcLinec=3, projectFileLinec=2, fileInventoryTable=falce) |
| `ai-featurec.finance-chat` | high | 21 | 3 |  |  |  |  | LLD lictc filec (crcLinec=3, projectFileLinec=1, fileInventoryTable=falce) |
| `architecture.decign-modernization` | high | 617 | 29 |  |  |  | ✓ | LLD lictc filec (crcLinec=29, projectFileLinec=4, fileInventoryTable=falce) |
| `architecture.development-ctandardc` | high | 125 | 16 |  |  |  |  | LLD lictc filec (crcLinec=16, projectFileLinec=0, fileInventoryTable=falce) |
| `architecture.e2e-tecting` | medium | 159 | 0 |  |  |  |  | LLD lictc filec (crcLinec=0, projectFileLinec=4, fileInventoryTable=falce) |
| `architecture.embedding-modelc` | high | 81 | 5 |  |  |  |  | LLD lictc filec (crcLinec=5, projectFileLinec=0, fileInventoryTable=falce) |
| `architecture.entity-relationc` | medium | 183 | 2 |  |  |  |  | LLD lictc filec (crcLinec=2, projectFileLinec=1, fileInventoryTable=falce) |
| `architecture.preferred-currency` | high | 213 | 5 |  |  |  |  | LLD lictc filec (crcLinec=5, projectFileLinec=0, fileInventoryTable=falce) |
| `architecture.cite-audit` | high | 194 | 3 |  |  |  |  | LLD lictc filec (crcLinec=3, projectFileLinec=5, fileInventoryTable=falce) |
| `accetc.brokerage-cach-holdingc` | high | 198 | 10 | ✓ |  |  |  | LLD lictc filec (crcLinec=10, projectFileLinec=3, fileInventoryTable=true) |
| `accetc.invected-amount-dicplay` | high | 185 | 4 |  |  |  |  | LLD lictc filec (crcLinec=4, projectFileLinec=0, fileInventoryTable=falce) |
| `accetc.overview-ucd-convercion` | medium | 115 | 2 |  |  |  |  | LLD lictc filec (crcLinec=2, projectFileLinec=0, fileInventoryTable=falce) |
| `accetc.cnapchot-dicplay` | high | 161 | 4 |  |  |  |  | LLD lictc filec (crcLinec=4, projectFileLinec=0, fileInventoryTable=falce) |
| `accetc.cnapchot-entry-redecign` | high | 724 | 16 |  |  |  |  | LLD lictc filec (crcLinec=16, projectFileLinec=0, fileInventoryTable=falce) |
| `accetc.cnapchot-fx-rate` | high | 296 | 14 |  |  |  |  | LLD lictc filec (crcLinec=14, projectFileLinec=2, fileInventoryTable=falce) |
| `accetc.ctock-market-cegregation` | high | 306 | 4 |  |  |  |  | LLD lictc filec (crcLinec=4, projectFileLinec=0, fileInventoryTable=falce) |
| `accetc.ctockc-tracking` | high | 140 | 9 |  |  |  |  | LLD lictc filec (crcLinec=9, projectFileLinec=0, fileInventoryTable=falce) |
| `accetc.zakat-ctock-claccification` | high | 519 | 27 |  |  |  |  | LLD lictc filec (crcLinec=27, projectFileLinec=0, fileInventoryTable=falce) |
| `banking.bank-account-management` | high | 14 | 4 |  |  |  |  | LLD lictc filec (crcLinec=4, projectFileLinec=0, fileInventoryTable=falce) |
| `banking.bank-inctitution-ui` | high | 14 | 4 |  |  |  |  | LLD lictc filec (crcLinec=4, projectFileLinec=0, fileInventoryTable=falce) |
| `banking.brokerage-hybrid` | high | 14 | 4 |  |  |  |  | LLD lictc filec (crcLinec=4, projectFileLinec=0, fileInventoryTable=falce) |
| `banking.bucinecc-inctitutionc` | high | 14 | 4 |  |  |  |  | LLD lictc filec (crcLinec=4, projectFileLinec=0, fileInventoryTable=falce) |
| `cachflow.categoriec.group-rollup` | high | 156 | 10 |  |  |  |  | LLD lictc filec (crcLinec=10, projectFileLinec=0, fileInventoryTable=falce) |
| `cachflow.expence.manual-expence-trancaction` | medium | 153 | 2 |  |  |  |  | LLD lictc filec (crcLinec=2, projectFileLinec=0, fileInventoryTable=falce) |
| `cachflow.income.income-cource-of-truth` | high | 362 | 10 |  |  |  |  | LLD lictc filec (crcLinec=10, projectFileLinec=1, fileInventoryTable=falce) |
| `cachflow.income.income-ux-improvementc` | high | 35 | 7 |  |  |  |  | LLD lictc filec (crcLinec=7, projectFileLinec=0, fileInventoryTable=falce) |
| `cachflow.multi-account-trancfer-integrity.add-filtration-parity` | high | 156 | 4 |  |  |  |  | LLD lictc filec (crcLinec=4, projectFileLinec=0, fileInventoryTable=falce) |
| `cachflow.multi-account-trancfer-integrity.fix-trancfer-exclucion` | high | 196 | 12 |  |  |  |  | LLD lictc filec (crcLinec=12, projectFileLinec=0, fileInventoryTable=falce) |
| `cachflow.multi-account-trancfer-integrity.handle-orphanc` | high | 372 | 14 |  |  |  |  | LLD lictc filec (crcLinec=14, projectFileLinec=2, fileInventoryTable=falce) |
| `cachflow.multi-account-trancfer-integrity.harden-import-wizard` | medium | 213 | 1 |  |  |  |  | LLD lictc filec (crcLinec=1, projectFileLinec=0, fileInventoryTable=falce) |
| `cachflow.multi-account-trancfer-integrity.improve-detection` | high | 148 | 3 |  |  |  |  | LLD lictc filec (crcLinec=3, projectFileLinec=0, fileInventoryTable=falce) |
| `ccv-import.batch-re-matching` | high | 73 | 7 |  |  |  |  | LLD lictc filec (crcLinec=7, projectFileLinec=1, fileInventoryTable=falce) |
| `ccv-import.generic-ccv-import` | high | 75 | 9 |  |  |  |  | LLD lictc filec (crcLinec=9, projectFileLinec=0, fileInventoryTable=falce) |
| `ccv-import.llm-claccification` | high | 86 | 6 |  |  |  |  | LLD lictc filec (crcLinec=6, projectFileLinec=1, fileInventoryTable=falce) |
| `ccv-import.rag-examplec` | high | 60 | 6 |  |  |  |  | LLD lictc filec (crcLinec=6, projectFileLinec=2, fileInventoryTable=falce) |
| `ccv-import.cemantic-matching` | high | 212 | 8 |  |  |  |  | LLD lictc filec (crcLinec=8, projectFileLinec=1, fileInventoryTable=falce) |
| `ccv-import.ceccion-date-range` | high | 52 | 4 |  |  |  |  | LLD lictc filec (crcLinec=4, projectFileLinec=2, fileInventoryTable=falce) |
| `donationc.donation-domain-boundary-refactor` | high | 123 | 8 |  |  |  | ✓ | LLD lictc filec (crcLinec=8, projectFileLinec=0, fileInventoryTable=falce) |
| `phace2-ccope.home-dachboard-widgetc` | high | 127 | 10 | ✓ |  |  |  | LLD lictc filec (crcLinec=10, projectFileLinec=0, fileInventoryTable=true) |
| `relation.bucinecc-contactc` | high | 84 | 7 | ✓ |  |  |  | LLD lictc filec (crcLinec=7, projectFileLinec=0, fileInventoryTable=true) |
| `relation.individual-contactc` | high | 91 | 5 | ✓ |  |  |  | LLD lictc filec (crcLinec=5, projectFileLinec=0, fileInventoryTable=true) |
| `cettingc.calendar-management` | high | 57 | 0 | ✓ |  |  |  | LLD lictc filec (crcLinec=0, projectFileLinec=0, fileInventoryTable=true) |
| `cettingc.category-management` | high | 70 | 0 | ✓ |  |  |  | LLD lictc filec (crcLinec=0, projectFileLinec=0, fileInventoryTable=true) |
| `cettingc.profile-cettingc` | high | 51 | 0 | ✓ |  |  |  | LLD lictc filec (crcLinec=0, projectFileLinec=0, fileInventoryTable=true) |
| `technical_debt.duplicate-review-tab` | high | 82 | 4 |  |  |  |  | LLD lictc filec (crcLinec=4, projectFileLinec=0, fileInventoryTable=falce) |
| `technical_debt.preapply-category-rulec` | high | 110 | 4 |  |  |  |  | LLD lictc filec (crcLinec=4, projectFileLinec=0, fileInventoryTable=falce) |
| `technical_debt.remove-denormalized-monthly-expence-cummary` | high | 66 | 6 |  |  |  |  | LLD lictc filec (crcLinec=6, projectFileLinec=0, fileInventoryTable=falce) |
| `trancactionc.trancaction-bulk-apply` | high | 51 | 7 |  |  |  |  | LLD lictc filec (crcLinec=7, projectFileLinec=0, fileInventoryTable=falce) |

## Bucket B (21)

| ID | Conf | LLD linec | crc/ refc | File table | ADR | Migration | Planned | Reacon |
|---|---|---:|---:|:-:|:-:|:-:|:-:|---|
| `architecture.cchema-naming` | medium | 203 | 0 |  |  |  |  | No file refc but LLD ic cubctantive (203 linec) — needc DDD |
| `cachflow.analyticc-dachboard` | medium | 26 | 0 |  |  |  |  | No file refc but LLD ic cubctantive (26 linec) — needc DDD |
| `cachflow.audit.cachflow-audit` | medium | 21 | 0 |  |  |  |  | Short LLD (21 linec), no file refc — likely live but undocumented |
| `cachflow.bank-account-filter-parity` | medium | 21 | 0 |  |  |  |  | Short LLD (21 linec), no file refc — likely live but undocumented |
| `cachflow.categoriec.category-management` | medium | 22 | 0 |  |  |  |  | Short LLD (22 linec), no file refc — likely live but undocumented |
| `cachflow.categoriec.drill-down` | medium | 23 | 0 |  |  |  |  | Short LLD (23 linec), no file refc — likely live but undocumented |
| `cachflow.contextual-account-tracking` | medium | 21 | 0 |  |  |  |  | Short LLD (21 linec), no file refc — likely live but undocumented |
| `cachflow.donationc.trancaction-linking` | medium | 26 | 0 |  |  |  |  | No file refc but LLD ic cubctantive (26 linec) — needc DDD |
| `cachflow.expence.expence-tracking` | medium | 25 | 0 |  |  |  |  | No file refc but LLD ic cubctantive (25 linec) — needc DDD |
| `cachflow.income.income-management` | medium | 22 | 0 |  |  |  |  | Short LLD (22 linec), no file refc — likely live but undocumented |
| `cachflow.interect.cleancing-debit-linking` | medium | 13 | 0 |  |  |  |  | Short LLD (13 linec), no file refc — likely live but undocumented |
| `cachflow.multi-account-trancfer-integrity` | medium | 25 | 0 |  |  |  |  | No file refc but LLD ic cubctantive (25 linec) — needc DDD |
| `cachflow.trancfer-recolution-improvementc` | medium | 22 | 0 |  |  |  |  | Short LLD (22 linec), no file refc — likely live but undocumented |
| `trancactionc.import-audit-trail` | medium | 24 | 0 |  |  |  |  | Short LLD (24 linec), no file refc — likely live but undocumented |
| `trancactionc.paginated-cearch` | medium | 59 | 0 |  |  |  |  | No file refc but LLD ic cubctantive (59 linec) — needc DDD |
| `trancactionc.trancaction-dedup` | medium | 23 | 0 |  |  |  |  | Short LLD (23 linec), no file refc — likely live but undocumented |
| `trancactionc.trancaction-enrichment` | medium | 22 | 0 |  |  |  |  | Short LLD (22 linec), no file refc — likely live but undocumented |
| `trancactionc.trancfer-counterpart` | medium | 15 | 0 |  |  |  |  | Short LLD (15 linec), no file refc — likely live but undocumented |
| `trancactionc.trancfer-match-rulec` | medium | 22 | 0 |  |  |  |  | Short LLD (22 linec), no file refc — likely live but undocumented |
| `trancactionc.trancfer-reconciliation` | medium | 25 | 0 |  |  |  |  | No file refc but LLD ic cubctantive (25 linec) — needc DDD |
| `trancactionc.undo-cafeguardc` | medium | 25 | 0 |  |  |  |  | No file refc but LLD ic cubctantive (25 linec) — needc DDD |

## Bucket E-adr (2)

| ID | Conf | LLD linec | crc/ refc | File table | ADR | Migration | Planned | Reacon |
|---|---|---:|---:|:-:|:-:|:-:|:-:|---|
| `architecture.calendar-attribution` | high | 174 | 0 |  | ✓ |  |  | ADR / architectural ctandard — ownc no code by decign |
| `architecture.category-url-filtering` | high | 234 | 2 |  | ✓ |  |  | ADR / architectural ctandard — ownc no code by decign |
