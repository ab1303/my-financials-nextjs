# Spec Folder Migration Map

**Status:** In Progress (90% complete)  
**Total features:** 48 across 11 domains  
**Consolidated:** 43 features across 7 domains (cashflow as unified 3-level domain with 14 features)  
**Remaining:** 5 features across 2 domains  
**Target structure:** `spec/{domain}/{feature}/` (2-level) or `spec/{domain}/{sub-group}/{feature}/` (3-level for complex domains)  
**Migration approach:** Vertical slicing for LLM context; 3-level only when 3+ independent sub-domains exist

---

## Domain Groupings

### 1. `transactions` (10 features) ✅ COMPLETE
Core transaction management, ledger, reconciliation, and deduplication.

| Current Folder | Target Location | Status |
|---|---|---|
| `transactions` | `transactions/transactions/` | ✅ Migrated |
| `transaction-ledger` | `transactions/transaction-ledger/` | ✅ Migrated |
| `transaction-dedup` | `transactions/transaction-dedup/` | ✅ Migrated |
| `transaction-enrichment-pipeline` | `transactions/transaction-enrichment/` | ✅ Migrated |
| `transfer-reconciliation` | `transactions/transfer-reconciliation/` | ✅ Migrated |
| `transfer-match-rules` | `transactions/transfer-match-rules/` | ✅ Migrated |
| `transfer-counterpart-display` | `transactions/transfer-counterpart/` | ✅ Migrated |
| `clear-transactions` | `transactions/transaction-clearing/` | ✅ Migrated |
| `undo-safeguards` | `transactions/undo-safeguards/` | ✅ Migrated |
| `reimbursements` | `transactions/reimbursements/` | ✅ Migrated |

### 2. `csv-import` (8 features) ✅ COMPLETE
CSV parsing, categorization, batching, matching, and archival.

| Current Folder | Target Location | Status |
|---|---|---|
| `csv-import` | `csv-import/csv-import/` | ✅ Migrated |
| `generic-csv-import` | `csv-import/generic-csv-import/` | ✅ Migrated |
| `csv-categorisation-llm-classification` | `csv-import/llm-classification/` | ✅ Migrated |
| `csv-categorisation-rag-examples` | `csv-import/rag-examples/` | ✅ Migrated |
| `batch-re-matching` | `csv-import/batch-re-matching/` | ✅ Migrated |
| `import-file-archival` | `csv-import/file-archival/` | ✅ Migrated |
| `import-session-date-range` | `csv-import/session-date-range/` | ✅ Migrated |
| `semantic-category-matching` | `csv-import/semantic-matching/` | ✅ Migrated |

### 3. `banking` (4 features) ✅ COMPLETE
Bank institutions, accounts, assets, and institution data.

| Current Folder | Target Location | Status |
|---|---|---|
| `bank-institution-ui` | `banking/bank-institution-ui/` | ✅ Migrated |
| `bank-account-management` | `banking/bank-account-management/` | ✅ Migrated |
| `business-global-institutions` | `banking/business-institutions/` | ✅ Migrated |
| `brokerage-hybrid-model` | `banking/brokerage-hybrid/` | ✅ Migrated |

### 3a. `assets` (4 features) ✅ COMPLETE
Asset tracking, net worth, and liquid cash accounts.

| Current Folder | Target Location | Status |
|---|---|---|
| `assets-net-worth-dashboard` | `assets/net-worth-dashboard/` | ✅ Migrated |
| `asset-stocks-tracking` | `assets/stocks-tracking/` | ✅ Migrated |
| `bank-assets` | `assets/bank-assets/` | ✅ Migrated |
| `snapshot-all-banks-display` | `assets/snapshot-display/` | ✅ Migrated |

### 4. `categories` ✅ CONSOLIDATED → MOVED TO CASHFLOW
**Status:** Moved under cashflow domain (see section 5a below)

**Why:** Categories are foundational taxonomy for all cashflows (income, expense, donations, interest). They enable categorization, aggregation, and drill-down filtering across all financial flows. Now under `spec/cashflow/categories/` as a sub-group.

### 5. `income-expense` (4 features) ✅ COMPLETE
Income, expense tracking, interest handling, and related UX.

| Current Folder | Target Location | Status |
|---|---|---|
| `income-management` | `income-expense/income-management/` | ✅ Migrated |
| `income-ux-improvements` | `income-expense/income-ux/` | ✅ Migrated |
| `expense-tracking` | `income-expense/expense-tracking/` | ✅ Migrated |
| `interest-cleansing` | `income-expense/interest-cleansing/` | ✅ Migrated |

### 5a. `cashflow` (14 features) ✅ COMPLETE — **3-Level Unified Financial Flows Domain**
Unified architecture for ALL cash movements and financial categorization: income inflows, expense outflows, donations/zakat outflows, category taxonomy, interest flows, and audit/reporting.

| Sub-group | Features | Target Location | Status | Count |
|---|---|---|---|---|
| **income** | income-management, income-ux | `cashflow/income/{feature}/` | ✅ | 2 |
| **expense** | expense-tracking | `cashflow/expense/{feature}/` | ✅ | 1 |
| **donations** | donations, zakat, transaction-linking | `cashflow/donations/{feature}/` | ✅ | 3 |
| **categories** | category-management, drill-down | `cashflow/categories/{feature}/` | ✅ | 2 |
| **interest** | interest-cleansing | `cashflow/interest/{feature}/` | ✅ | 1 |
| **audit** | cashflow-audit | `cashflow/audit/{feature}/` | ✅ | 1 |

**Structure:**
```
spec/cashflow/
  hld.md (unified financial flows + category taxonomy)
  income/ (2 features)
  expense/ (1 feature)
  donations/ (3 features)
  categories/ (2 features) ← Shared taxonomy
    ├─ category-management
    └─ drill-down
  interest/ (1 feature)
  audit/ (1 feature)
```

**Architectural Rationale:**
- **Unified cashflow concept**: All financial flows (income, expense, donations, interest) are movements of money, organized via categories
- **3-level with 6 sub-groups**: Categories are foundational taxonomy enabling income/expense organization, donation/interest categorization, and drill-down filtering
- **Categories as infrastructure**: Shared by all cashflow sub-groups; the HLD explains how category model applies across all flows
- **LLM-friendly**: HLD provides complete financial taxonomy patterns; agents fetch sub-group contexts for focused slices (e.g., expense categorization, income drill-down)

### 6. `ai-features` (3 features) ⏳ PENDING
AI-driven features: image import, usage logging, chat.

| Current Folder | Target Location | Status |
|---|---|---|
| `ai-image-import` | `ai-features/ai-image-import/` | ⏳ Pending |
| `ai-usage-logging` | `ai-features/ai-usage-logging/` | ⏳ Pending |
| `finance-chat-assistant` | `ai-features/finance-chat/` | ⏳ Pending |

### 7. `donations` ✅ CONSOLIDATED → MOVED TO CASHFLOW
**Status:** Moved under cashflow domain (see section 5a above)

**Why:** Donations and zakat are cash outflows, conceptually part of unified financial flows. Now organized under `spec/cashflow/donations/` as a sub-group alongside income, expense, interest.

### 8. `reimbursements` (1 feature)
Standalone reimbursement feature.

| Current Folder | Target Location | Notes |
|---|---|---|
| `reimbursements` | `reimbursements/reimbursements/` | **Domain HLD goes here** |

### 9. `user-profile` (1 feature) ✅ COMPLETE
User profile and preferences.

| Current Folder | Target Location | Status |
|---|---|---|
| `user-profile` | `user-profile/user-profile/` | ✅ Migrated |

**Rationale:** User profile is foundational; manages user identity, authentication context, and cross-app preferences (currency display, fiscal year settings, theme). 2-level structure (domain HLD + 1 feature).

### 8. `architecture` (9 features) ⏳ PENDING
App-wide architectural guidelines, standards, infrastructure, and research.

| Current Folder | Target Location | Type | Status |
|---|---|---|---|
| `calendar-attribution-architecture` | `architecture/calendar-attribution/` | Architecture | ⏳ Pending |
| `design-modernization` | `architecture/design-modernization/` | Guidelines/Infrastructure | ⏳ Pending |
| `development-standards` | `architecture/development-standards/` | Guidelines | ⏳ Pending |
| `e2e-testing` | `architecture/e2e-testing/` | Infrastructure | ⏳ Pending |
| `embedding-models-comparison` | `architecture/embedding-models/` | Research | ⏳ Pending |
| `entity-relations` | `architecture/entity-relations/` | Architecture | ⏳ Pending |
| `preferred-currency-display` | `architecture/preferred-currency/` | Infrastructure | ⏳ Pending |
| `schema-naming-review` | `architecture/schema-naming/` | Guidelines | ⏳ Pending |
| `site-audit` | `architecture/site-audit/` | Audit | ⏳ Pending |

**Rationale:** These are app-wide architectural concerns, not domain-specific features. They establish patterns, standards, and infrastructure used across all domains.

---

## Migration Phases

### Phase 1: Plan & Document ✅ COMPLETE
- ✅ AGENTS.md updated with new structure
- ✅ spec-from-context skill updated
- ✅ spec-migration-map.md created (this file)
- ✅ Migration guide created (spec-consolidation.md)
- ✅ Migration template created (migration-agent-template.md)

### Phase 2: Execute Consolidations ✅ COMPLETE (90%)
- ✅ Transactions domain (10 features, 2-level)
- ✅ CSV-import domain (8 features, 2-level)
- ✅ Assets domain (4 features, 2-level)
- ✅ Banking domain (4 features, 2-level)
- ✅ **Cashflow domain (14 features, 3-level with 6 sub-groups)** ← Unified: income, expense, donations, categories, interest, audit
- ✅ User-profile domain (1 feature, 2-level)
- ⏳ AI-features domain (3 features remaining)
- ⏳ **Architecture domain (9 features remaining)** ← App-wide guidelines, standards, infrastructure

### Phase 3: Remaining Work (10% — 5 features)
- 3 features in ai-features (ai-image-import, ai-usage-logging, finance-chat)
- 9 features in **architecture** (app-wide guidelines, standards, infrastructure)

### Phase 3: Selective Migration (Ongoing)
- On each feature touch, migrate its spec folder
- No forced bulk migration
- Gradually move all 48 features

### Phase 4: Archive Cleanup (Future)
- Move historical summaries (e.g., `*_SUMMARY.md`) to `archived/`
- Keep only canonical 3 files per feature

---

## Migration Model Recommendations

**Key insight:** Spec migration is mostly **mechanical restructuring** with no novel reasoning required. This makes it ideal for cheaper, faster models.

### Recommended Model by Task

| Task | Model | Why |
|---|---|---|
| **Analyze current structure** | Claude 3.5 Sonnet (main session) | Human oversight, strategic decisions |
| **Migrate domain spec** | `gpt-4.1` (background agent) | Mechanical file reorganization, no context loss |
| **Validate migration** | Claude Haiku (quick check) | File structure validation |
| **Document learnings** | Claude Sonnet (main session) | Synthesis for next phases |

### Cost Savings

- Full domain migration (e.g., `transactions` 9 specs): ~2 min with gpt-4.1 vs ~5 min with Sonnet
- For all 48 specs: ~90 min total with gpt-4.1 vs ~240 min with Sonnet = **~60% time savings**

### Why gpt-4.1 Is Safe Here

✅ **No context loss** — Migration is pattern matching (old path → new path, restructure 3 files)  
✅ **No novel design** — The structure is already defined in AGENTS.md  
✅ **High precision needed** — Mechanical work, low risk of hallucination  
✅ **Validation is easy** — File counts, structure, path correctness are all verifiable  

---

## Next Steps

1. **Create migration guide** (`.github/instructions/migration-agent-template.md`) with agent template
2. **Run pilot** on `transactions` domain using gpt-4.1 background agent
3. **Document learnings** and estimate remaining 47 features
4. **Proceed with selective migration** as features are touched
