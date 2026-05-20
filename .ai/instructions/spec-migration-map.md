# Spec Folder Migration Map

**Status:** In Progress (79% complete)  
**Total features:** 48 across 11 domains  
**Consolidated:** 39 features across 7 domains (cashflow upgraded to 3-level with 5 features)  
**Remaining:** 9 features across 4 domains  
**Target structure:** `spec/{domain}/{feature}/` (2-level) or `spec/{domain}/{group}/{feature}/` (3-level for complex domains)  
**Migration approach:** Opportunistic consolidation per domain; 3-level promotion when 3+ phases exist

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

### 4. `categories` (2 features) ⏳ PENDING
Category management, categorization, and semantic matching.

| Current Folder | Target Location | Status |
|---|---|---|
| `category-management` | `categories/category-management/` | ⏳ Pending |
| `category-transaction-drill-down` | `categories/drill-down/` | ⏳ Pending |

**Note:** `semantic-category-matching` was moved to `csv-import/semantic-matching/` (it's a CSV categorization service, not a standalone category feature)

### 5. `income-expense` (4 features) ✅ COMPLETE
Income, expense tracking, interest handling, and related UX.

| Current Folder | Target Location | Status |
|---|---|---|
| `income-management` | `income-expense/income-management/` | ✅ Migrated |
| `income-ux-improvements` | `income-expense/income-ux/` | ✅ Migrated |
| `expense-tracking` | `income-expense/expense-tracking/` | ✅ Migrated |
| `interest-cleansing` | `income-expense/interest-cleansing/` | ✅ Migrated |

### 5a. `cashflow` (5 features) ✅ COMPLETE — **3-Level Structure**
Unified financial flows: income, expense, interest, and audit/reporting.

| Sub-group | Features | Target Location | Status |
|---|---|---|---|
| **income** | income-management, income-ux | `cashflow/income/{feature}/` | ✅ Migrated |
| **expense** | expense-tracking | `cashflow/expense/{feature}/` | ✅ Migrated |
| **interest** | interest-cleansing | `cashflow/interest/{feature}/` | ✅ Migrated |
| **audit** | cashflow-audit | `cashflow/audit/{feature}/` | ✅ Migrated |

**Structure:**
```
spec/cashflow/
  hld.md (unified financial flows architecture)
  income/
    income-management/
    income-ux-improvements/
  expense/
    expense-tracking/
  interest/
    interest-cleansing/
  audit/
    cashflow-audit/
```

**Rationale:** Cashflow is the unified concept for all financial flows (income sources, expenses, interest, and reporting). Promoted to 3-level structure because it has 4 independent sub-domains (income, expense, interest, audit). Sub-group folders organize related features without increasing complexity.

### 6. `ai-features` (3 features) ⏳ PENDING
AI-driven features: image import, usage logging, chat.

| Current Folder | Target Location | Status |
|---|---|---|
| `ai-image-import` | `ai-features/ai-image-import/` | ⏳ Pending |
| `ai-usage-logging` | `ai-features/ai-usage-logging/` | ⏳ Pending |
| `finance-chat-assistant` | `ai-features/finance-chat/` | ⏳ Pending |

### 7. `donations` (3 features) ✅ COMPLETE
Donations, zakat, and related transaction linking.

| Current Folder | Target Location | Status |
|---|---|---|
| `donations` | `donations/donations/` | ✅ Migrated |
| `donation-transaction-linking` | `donations/transaction-linking/` | ✅ Migrated |
| `zakat` | `donations/zakat/` | ✅ Migrated |

**Note:** Zakat (Islamic obligatory giving) is grouped under donations as a charitable giving feature.

### 8. `reimbursements` (1 feature)
Standalone reimbursement feature.

| Current Folder | Target Location | Notes |
|---|---|---|
| `reimbursements` | `reimbursements/reimbursements/` | **Domain HLD goes here** |

### 9. `user-profile` (1 feature) ⏳ PENDING
User profile and preferences.

| Current Folder | Target Location | Status |
|---|---|---|
| `user-profile` | `user-profile/user-profile/` | ⏳ Pending |

### 8. `standalone` (9 features) ⏳ PENDING
Miscellaneous, cross-cutting, or architectural features without strong domain affinity.

| Current Folder | Target Location | Status |
|---|---|---|
| `calendar-attribution-architecture` | `standalone/calendar-attribution/` | ⏳ Pending |
| `design-modernization` | `standalone/design-modernization/` | ⏳ Pending |
| `development-standards` | `standalone/development-standards/` | ⏳ Pending |
| `e2e-testing` | `standalone/e2e-testing/` | ⏳ Pending |
| `embedding-models-comparison` | `standalone/embedding-models/` | ⏳ Pending |
| `entity-relations` | `standalone/entity-relations/` | ⏳ Pending |
| `preferred-currency-display` | `standalone/preferred-currency/` | ⏳ Pending |
| `schema-naming-review` | `standalone/schema-naming/` | ⏳ Pending |
| `site-audit` | `standalone/site-audit/` | ⏳ Pending |

---

## Migration Phases

### Phase 1: Plan & Document ✅ COMPLETE
- ✅ AGENTS.md updated with new structure
- ✅ spec-from-context skill updated
- ✅ spec-migration-map.md created (this file)
- ✅ Migration guide created (spec-consolidation.md)
- ✅ Migration template created (migration-agent-template.md)

### Phase 2: Execute Consolidations ✅ COMPLETE (79%)
- ✅ Transactions domain (10 features, 2-level)
- ✅ CSV-import domain (8 features, 2-level)
- ✅ Assets domain (4 features, 2-level)
- ✅ Banking domain (4 features, 2-level)
- ✅ **Cashflow domain (5 features, 3-level with sub-groups)** ← Promoted for financial flows organization
- ✅ Donations domain (3 features, 2-level)
- ⏳ Categories domain (2 features remaining)
- ⏳ AI-features domain (3 features remaining)
- ⏳ Standalone domain (9 features remaining)
- ⏳ User-profile domain (1 feature remaining)

### Phase 3: Remaining Work (21% — 9 features)
- 2 features in categories (category-management, category-drill-down)
- 3 features in ai-features (ai-image-import, ai-usage-logging, finance-chat)
- 9 features in standalone (cross-cutting, non-domain-specific)
- 1 feature in user-profile (user-profile)
- Estimated: 1-2 more consolidation sessions

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
