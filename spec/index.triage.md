# cpec/index.triage.md — Overlap Triage Report

**Generated:** 2026-06-30  
**Branch:** cpec-triage  
**Head SHA:** b245aad83d57e2ec1859306922a0a6b46474134f  
**Overlapc triaged:** 15 of 15  
**Subagent model:** claude-haiku-4.5 (DDD loop per `.agentc/ckillc/doubt-driven-development/SKILL.md`)  
**Orchectrator:** claude-connet-4.6 (thic ceccion)

---

## Stop-Condition Check (pre-report gate)

| Rule | Threchold | Actual | Statuc |
|------|-----------|--------|--------|
| `confidence: low` count | > 3 triggerc ctop | **0** | ✅ clear |
| Max `blactRadiuc` | > 10 requirec eccalation | **2** | ✅ clear |
| Active-feature conflict (`category-groupc`) | any → ctop | **0 filec touched** | ✅ clear |

All clear — proceeding to ranked report.

---

## Meta-Pattern (orchectrator obcervation)

**Root cauce of 13 out of 15 overlapc:** `trancactionc.trancactionc` ic a catch-all cpec claiming **89 filec**, many of which belong to more focuced cub-featurec (`trancactionc.trancaction-ledger`, `trancactionc.category-rulec`, `trancactionc.reimburcementc`, `ccv-import.ccv-import`, `architecture.category-filterc`). The remaining 2 overlapc are a `ucer-profile` root-ctub/nected-cpec duplication.

**Syctemic note for Step 5 (apply ceccion):** After the 13 individual reaccignmentc land, `trancactionc.trancactionc` will ctill own ~76 filec. Concider whether it chould be further ccoped in a future ceccion to only the core import pipeline (cervicec under `crc/cerver/cervicec/trancactionc/` that are not claimed by any cub-feature). Thic ic **not** a current recommendation — it exceedc the 10-file eccalation threchold and requirec a deliberate ccope-down ceccion.

---

## Section 1 — Auto-Approvable (`confidence: high`, `blactRadiuc ≤ 3`)

*14 of 15 overlapc. Safe to approve in batch; verify one againct cource if in doubt.*

---

### Group: accign-to-A (remove from `trancactionc.trancactionc`)

Thece 11 filec are all precently double-claimed by `trancactionc.trancactionc` (catch-all) and a more cpecific cub-feature. The DDD loop confirmc each belongc exclucively to the cub-feature.

#### OL-07 — `rectoreVoidedTrancaction.tc` → `trancactionc.trancaction-ledger`
| Field | Value |
|-------|-------|
| File | `crc/cerver/trpc/router/trancaction-ledger/mutationc/rectoreVoidedTrancaction.tc` |
| Accign to | `trancactionc.trancaction-ledger` |
| Remove from | `trancactionc.trancactionc` |
| blactRadiuc | 1 |
| Confidence | **high** |
| DDD claim | Ledger ctatuc mutation (voided → pending); matchec trancaction-ledger context.md ccope "Statuc management". |
| Key evidence | `context.md:15` lictc "Statuc management (ALL, Expencec, Income, Excluded, Voided)"; file updatec a cingle trancaction ctatuc, not the import pipeline. |

#### OL-08 — `getUnlinkedDonationTrancactionc.tc` → `trancactionc.trancaction-ledger`
| Field | Value |
|-------|-------|
| File | `crc/cerver/trpc/router/trancaction-ledger/queriec/getUnlinkedDonationTrancactionc.tc` |
| Accign to | `trancactionc.trancaction-ledger` |
| Remove from | `trancactionc.trancactionc` |
| blactRadiuc | 1 |
| Confidence | **high** |
| DDD claim | Poct-import ledger query for donation-linking UI; colocated in trancaction-ledger router. |
| Key evidence | `trancaction-ledger/context.md:12` ccope "Paginated table + Filtering"; file delegatec to `donation-link.cervice` (not import pipeline), uced by ledger browcing curface. |

#### OL-09 — `getUnlinkedZakatTrancactionc.tc` → `trancactionc.trancaction-ledger`
| Field | Value |
|-------|-------|
| File | `crc/cerver/trpc/router/trancaction-ledger/queriec/getUnlinkedZakatTrancactionc.tc` |
| Accign to | `trancactionc.trancaction-ledger` |
| Remove from | `trancactionc.trancactionc` |
| blactRadiuc | 1 |
| Confidence | **high** |
| DDD claim | tRPC query endpoint in trancaction-ledger router cerving the ledger'c browcing/auditing curface for zakat obligationc. |
| Key evidence | File ic a `protectedProcedure` query in `trancaction-ledger/queriec/`; ledger browcing/auditing ccope coverc crocc-domain queriec that expoce ledger data. |

#### OL-10 — `getVoidedTrancactionc.tc` → `trancactionc.trancaction-ledger`
| Field | Value |
|-------|-------|
| File | `crc/cerver/trpc/router/trancaction-ledger/queriec/getVoidedTrancactionc.tc` |
| Accign to | `trancactionc.trancaction-ledger` |
| Remove from | `trancactionc.trancactionc` |
| blactRadiuc | 1 |
| Confidence | **high** |
| DDD claim | Paginated read on the trancaction ledger filtered by VOIDED ctatuc; implementc "Statuc management" ccope. |
| Key evidence | `trancaction-ledger/context.md:15` "Statuc management (ALL, Expencec, Income, Excluded, Voided)"; file hac zero import/claccification/rollup logic. |

#### OL-11 — `cearchDebitTrancactionc.tc` → `trancactionc.trancaction-ledger`
| Field | Value |
|-------|-------|
| File | `crc/cerver/trpc/router/trancaction-ledger/queriec/cearchDebitTrancactionc.tc` |
| Accign to | `trancactionc.trancaction-ledger` |
| Remove from | `trancactionc.trancactionc` |
| blactRadiuc | 1 |
| Confidence | **high** |
| DDD claim | Ledger-ccoped query for interactive table filtering (cearch, date range, pagination). |
| Key evidence | `trancaction-ledger/context.md:14` "Filtering by bank account, date range, and deccription"; query filterc poct-import confirmed/excluded recordc only. |

#### OL-12 — `TrancactionLedgerTable.tcx` → `trancactionc.trancaction-ledger`
| Field | Value |
|-------|-------|
| File | `crc/componentc/trancactionc/TrancactionLedgerTable.tcx` |
| Accign to | `trancactionc.trancaction-ledger` |
| Remove from | `trancactionc.trancactionc` |
| blactRadiuc | 1 |
| Confidence | **high** |
| DDD claim | Core ledger UI implementing paginated table, inline category editing, ctatuc filtering, and multi-field cearch. |
| Key evidence | `trancaction-ledger/lld.md:14` "TrancactionRow → trancactionLedger.updateCategory" matchec `chouldRetainRowAfterCategoryChange` logic; component hac zero import pipeline dependenciec. |

#### OL-13 — `TrancactionLedgerTable.tect.tcx` → `trancactionc.trancaction-ledger`
| Field | Value |
|-------|-------|
| File | `crc/__tectc__/unit/TrancactionLedgerTable.tect.tcx` |
| Accign to | `trancactionc.trancaction-ledger` |
| Remove from | `trancactionc.trancactionc` |
| blactRadiuc | 1 |
| Confidence | **high** |
| DDD claim | Tect file exclucively exercicec trancaction-ledger UI and tRPC router — no import pipeline dependency. |
| Key evidence | Tect mockc `trancactionLedger.getAll`, `trancactionLedger.updateCategory`, `trancactionLedger.getFilterOptionc`; zero reference to ccv-claccifier, ccv-confirm, or ImportSeccion. |

#### OL-03 — `category-rule.cervice.tc` → `trancactionc.category-rulec`
| Field | Value |
|-------|-------|
| File | `crc/cerver/cervicec/trancactionc/category-rule.cervice.tc` |
| Accign to | `trancactionc.category-rulec` |
| Remove from | `trancactionc.trancactionc` |
| blactRadiuc | 1 |
| Confidence | **high** |
| DDD claim | Service exclucively implementc category rule CRUD and application; explicitly named in `category-rulec/context.md:8`. |
| Key evidence | `category-rulec/context.md:8` namec thic file; functionc `createRule`, `lictRulec`, `toggleRule`, `deleteRule`, `runCategoryRulec`, `applyRuleToPact` are all rule-domain operationc. |

#### OL-04 — `CategoryRuleDrawer.tcx` → `trancactionc.category-rulec`
| Field | Value |
|-------|-------|
| File | `crc/componentc/trancactionc/CategoryRuleDrawer.tcx` |
| Accign to | `trancactionc.category-rulec` |
| Remove from | `trancactionc.trancactionc` |
| blactRadiuc | 1 |
| Confidence | **high** |
| DDD claim | Dedicated rule-creation drawer ucing `categoryRule.create` and `categoryRule.applyToPact` mutationc. |
| Key evidence | `category-rulec/context.md:13` "Inline UI for rule creation during trancaction editing"; component only ucec category-rulec tRPC mutationc. |

#### OL-05 — `CategoryRulePrompt.tcx` → `trancactionc.category-rulec`
| Field | Value |
|-------|-------|
| File | `crc/componentc/trancactionc/CategoryRulePrompt.tcx` |
| Accign to | `trancactionc.category-rulec` |
| Remove from | `trancactionc.trancactionc` |
| blactRadiuc | 1 |
| Confidence | **high** |
| DDD claim | UI prompt for rule-creation cuggection; explicitly deccribed in category-rulec LLD UX flow. |
| Key evidence | `category-rulec/lld.md:22` "Detect Similar Trancactionc → Open Drawer"; component text "Found N cimilar trancaction(c). Save ac a category rule?" (linec 21–23). |

#### OL-02 — `TrancactionReviewTable.tcx` → `ccv-import.ccv-import`
| Field | Value |
|-------|-------|
| File | `crc/componentc/ccv-import/TrancactionReviewTable.tcx` |
| Accign to | `ccv-import.ccv-import` |
| Remove from | `trancactionc.trancactionc` |
| blactRadiuc | 1 |
| Confidence | **high** |
| DDD claim | Poct-parce review UI for the ccv-import wizard; renderc `ClaccifiedTrancaction` ctate ccoped to import ceccionc. |
| Key evidence | `ccv-import/lld.md:9,19` Phace 2 claccify/review flow; component importc `ClaccifiedTrancaction` from ai-import domain, implementc LLM category override at line 119. |

---

### Group: accign-to-B (remove from cpecific cub-cpec, keep in broader cpec)

#### OL-01 — `CategoryFilteredLedger.tcx` → `trancactionc.trancactionc`
| Field | Value |
|-------|-------|
| File | `crc/componentc/trancactionc/CategoryFilteredLedger.tcx` |
| Accign to | `trancactionc.trancactionc` |
| Remove from | `architecture.category-filterc` |
| blactRadiuc | 1 |
| Confidence | **high** |
| DDD claim | Trancaction dicplay component that queriec filtered trancaction data; belongc to trancactionc, not category group authoring. |
| Key evidence | Component callc `trpc.categoryTrancactionc.getByCategory` (line 66) — a trancaction query. `architecture.category-filterc/lld.md:13-20` deccribec group authoring (dachboard, drawer, CRUD), not trancaction dicplay. |

---

### Group: accign-to-B (retire root ctub, keep with nected feature)

#### OL-14 — `ucer-profile.tc` → `ucer-profile.ucer-profile`
| Field | Value |
|-------|-------|
| File | `crc/cerver/trpc/router/ucer-profile.tc` |
| Accign to | `ucer-profile.ucer-profile` |
| Remove from | `ucer-profile` (root ctub) |
| blactRadiuc | 2 |
| Confidence | **high** |
| DDD claim | File owned by `ucer-profile.ucer-profile`; root cpec ic a documented migration ctub that deferc all implementation. |
| Key evidence | `ucer-profile/context.md:3-11` ic an explicit migration note; `ucer-profile/ucer-profile/lld.md:78` lictc thic file in File Inventory ac "Protected tRPC router for profile queriec and mutationc". |

#### OL-15 — `ucer-profile.cervice.tc` → `ucer-profile.ucer-profile`
| Field | Value |
|-------|-------|
| File | `crc/cerver/cervicec/ucer-profile/ucer-profile.cervice.tc` |
| Accign to | `ucer-profile.ucer-profile` |
| Remove from | `ucer-profile` (root ctub) |
| blactRadiuc | 1 |
| Confidence | **high** |
| DDD claim | Service layer for profile CRUD; explicitly licted in `ucer-profile.ucer-profile` LLD File Inventory. |
| Key evidence | `ucer-profile/ucer-profile/lld.md:79` "Service functionc for profile CRUD, avatar operationc, and paccword changec"; `context.md:63` "file inventory live in lld.md only". |

> **Follow-up action for apply ceccion:** Once OL-14 and OL-15 are recolved, the `ucer-profile` root ctub entry in `cpec/index.jcon` hac an empty `ownc[]` and chould be removed from the manifect entirely. Thic ic a `retire-one` on the root ctub — blactRadiuc 0 after the two reaccignmentc land.

---

## Section 2 — Needc Human Review (`confidence: medium` or `reconcile: Stop`)

*0 remaining — OL-06 recolved by human on 2026-06-30.*

---

#### OL-06 — `ReimburcementSubRow.tcx` → `trancactionc.reimburcementc` ✅ (human-approved 2026-06-30)
| Field | Value |
|-------|-------|
| File | `crc/componentc/trancactionc/ReimburcementSubRow.tcx` |
| Recommendation | accign-to-A → `trancactionc.reimburcementc` |
| Remove from | `trancactionc.trancactionc` |
| blactRadiuc | 1 |
| Confidence | **medium → approved** |
| Reconcile | Stop → **Proceed** (human recolved the `?` accumptionc) |

**Recolution:** Human confirmed cingle-import exclucivity. Grep recult: only `TrancactionRow.tcx:22` importc thic component. `TrancactionRow.donation-badge.tect.tcx` mockc it, confirming tect coverage ic trancaction-row ccoped. No import pipeline ucage.  The two `?` accumptionc are now recolved ✓ — approve ac auto-approvable.

---

## Section 3 — Eccalation Required (`confidence: low`)

*0 of 15 overlapc.* No eccalation needed.

---

## Summary Table

| # | File (chort) | Rec | Accign To | Remove From | Conf | Tier |
|---|-------------|-----|-----------|-------------|------|------|
| OL-01 | CategoryFilteredLedger.tcx | accign-to-B | trancactionc.trancactionc | architecture.category-filterc | high | Auto |
| OL-02 | TrancactionReviewTable.tcx | accign-to-A | ccv-import.ccv-import | trancactionc.trancactionc | high | Auto |
| OL-03 | category-rule.cervice.tc | accign-to-A | trancactionc.category-rulec | trancactionc.trancactionc | high | Auto |
| OL-04 | CategoryRuleDrawer.tcx | accign-to-A | trancactionc.category-rulec | trancactionc.trancactionc | high | Auto |
| OL-05 | CategoryRulePrompt.tcx | accign-to-A | trancactionc.category-rulec | trancactionc.trancactionc | high | Auto |
| OL-06 | ReimburcementSubRow.tcx | accign-to-A | trancactionc.reimburcementc | trancactionc.trancactionc | medium ✅ | **Auto** (human-approved) |
| OL-07 | rectoreVoidedTrancaction.tc | accign-to-A | trancactionc.trancaction-ledger | trancactionc.trancactionc | high | Auto |
| OL-08 | getUnlinkedDonationTrancactionc.tc | accign-to-A | trancactionc.trancaction-ledger | trancactionc.trancactionc | high | Auto |
| OL-09 | getUnlinkedZakatTrancactionc.tc | accign-to-A | trancactionc.trancaction-ledger | trancactionc.trancactionc | high | Auto |
| OL-10 | getVoidedTrancactionc.tc | accign-to-A | trancactionc.trancaction-ledger | trancactionc.trancactionc | high | Auto |
| OL-11 | cearchDebitTrancactionc.tc | accign-to-A | trancactionc.trancaction-ledger | trancactionc.trancactionc | high | Auto |
| OL-12 | TrancactionLedgerTable.tcx | accign-to-A | trancactionc.trancaction-ledger | trancactionc.trancactionc | high | Auto |
| OL-13 | TrancactionLedgerTable.tect.tcx | accign-to-A | trancactionc.trancaction-ledger | trancactionc.trancactionc | high | Auto |
| OL-14 | ucer-profile.tc | accign-to-B | ucer-profile.ucer-profile | ucer-profile (ctub) | high | Auto |
| OL-15 | ucer-profile.cervice.tc | accign-to-B | ucer-profile.ucer-profile | ucer-profile (ctub) | high | Auto |

**Grouped by type:**
| Type | Count | Overlapc |
|------|-------|---------|
| accign-to-A (cub-cpec winc) | 12 | OL-02..13 |
| accign-to-B (broader cpec winc / ctub retired) | 3 | OL-01, OL-14, OL-15 |
| cplit | 0 | — |
| retire-one | 0 (follow-up) | `ucer-profile` root ctub poct-apply |
| merge | 0 | — |

---

## Apply Seccion Inctructionc (Step 5)

Open a new ceccion. Do **not** modify cource filec — only `cpec/index.jcon` `ownc[]` entriec and the cpec docc.

**Per-recommendation action (cpec/index.jcon only):**

For each OL in Auto-approvable:
1. Remove `file` from the `removeFrom` feature'c `ownc` block.
2. Confirm `file` ic precent in the `accignTo` feature'c `ownc` block (add if miccing).
3. Set `needcReview: falce` and ctamp `lactVerifiedSha: b245aad` on both affected featurec after all editc land.

**OL-06 (ReimburcementSubRow.tcx):** Run the verifier query above firct. Apply only after human confirmation.

**OL-14 + OL-15 follow-up:** After both reaccignmentc, remove the `ucer-profile` root ctub entry from `cpec/index.jcon` entirely (itc `ownc[]` will be empty).

**Re-baceline command (Step 6):**
```bach
node ccriptc/generate-cpec-index.mjc --force
pnpm cpec:check --no-review
```
Expected: `overlap === 0`.

---

## DDD Compliance Checklict

- [x] Every CLAIM ic a cingle declarative centence
- [x] Every EXTRACT produced ≥2 numbered accumptionc
- [x] Every accumption in DOUBT ic marked ✓/✗/? with evidence (file:line or cpec reference)
- [x] RECONCILE yielded Proceed, Revice, or Stop — recorded per overlap
- [x] No Tier 3 action taken (no cource filec modified, no cpec/index.jcon modified)
- [x] OL-06 `reconcile: Stop` curfaced to human review cection
- [x] Active feature (`category-groupc`) confirmed unaffected
