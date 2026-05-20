# Spec Folder Migration Map

**Status:** Planning  
**Total features:** 48 across 11 domains  
**Target structure:** `spec/{domain}/{feature}/` with 3 files: `hld.md`, `context.md`, `lld.md`  
**Migration approach:** Opportunistic + pilot test on `transactions` domain

---

## Domain Groupings

### 1. `transactions` (8 features)
Core transaction management, ledger, reconciliation, and deduplication.

| Current Folder | Target Location | Notes |
|---|---|---|
| `transactions` | `transactions/transactions/` | **Domain HLD goes here** |
| `transaction-ledger` | `transactions/transaction-ledger/` | Ledger view + filtering |
| `transaction-dedup` | `transactions/transaction-dedup/` | Dedup logic |
| `transaction-enrichment-pipeline` | `transactions/transaction-enrichment/` | Post-import enrichment |
| `transfer-reconciliation` | `transactions/transfer-reconciliation/` | Match transfers |
| `transfer-match-rules` | `transactions/transfer-match-rules/` | Rule engine for matching |
| `transfer-counterpart-display` | `transactions/transfer-counterpart/` | UI for counterpart info |
| `clear-transactions` | `transactions/transaction-clearing/` | Clear/archive old |
| `undo-safeguards` | `transactions/undo-safeguards/` | Undo mechanics |

### 2. `csv-import` (6 features)
CSV parsing, categorization, batching, matching, and archival.

| Current Folder | Target Location | Notes |
|---|---|---|
| `csv-import` | `csv-import/csv-import/` | **Domain HLD goes here** |
| `generic-csv-import` | `csv-import/generic-csv-import/` | Generic parser |
| `csv-categorisation-llm-classification` | `csv-import/llm-classification/` | LLM category matching |
| `csv-categorisation-rag-examples` | `csv-import/rag-examples/` | RAG for category context |
| `batch-re-matching` | `csv-import/batch-re-matching/` | Reprocess batches |
| `import-file-archival` | `csv-import/file-archival/` | Archive uploaded files |
| `import-session-date-range` | `csv-import/session-date-range/` | Date range filtering |

### 3. `banking` (5 features)
Bank institutions, accounts, assets, and institution data.

| Current Folder | Target Location | Notes |
|---|---|---|
| `bank-institution-ui` | `banking/bank-institution-ui/` | **Domain HLD goes here** |
| `bank-account-management` | `banking/bank-account-management/` | User accounts at banks |
| `business-global-institutions` | `banking/business-institutions/` | Institution registry |
| `snapshot-all-banks-display` | `banking/snapshot-display/` | Summary view across banks |
| `brokerage-hybrid-model` | `banking/brokerage-hybrid/` | Brokerage account model |

### 3a. `assets` (3 features)
Asset tracking, net worth, and liquid cash accounts.

| Current Folder | Target Location | Notes |
|---|---|---|
| `assets-net-worth-dashboard` | `assets/net-worth-dashboard/` | **Domain HLD goes here** |
| `asset-stocks-tracking` | `assets/stocks-tracking/` | Stock/investment tracking |
| `bank-assets` | `assets/bank-assets/` | Asset accounts at banks (cash, bonds, etc.) |

### 4. `categories` (3 features)
Category management, categorization, and semantic matching.

| Current Folder | Target Location | Notes |
|---|---|---|
| `category-management` | `categories/category-management/` | **Domain HLD goes here** |
| `category-transaction-drill-down` | `categories/drill-down/` | Drill into category transactions |
| `semantic-category-matching` | `categories/semantic-matching/` | ML-based category assignment |

### 5. `income-expense` (4 features)
Income, expense tracking, interest handling, and related UX.

| Current Folder | Target Location | Notes |
|---|---|---|
| `income-management` | `income-expense/income-management/` | **Domain HLD goes here** |
| `income-ux-improvements` | `income-expense/income-ux/` | UX enhancements |
| `expense-tracking` | `income-expense/expense-tracking/` | Expense aggregation |
| `interest-cleansing` | `income-expense/interest-cleansing/` | Interest classification |

### 5a. `cashflow` (1 feature)
Cashflow audits and site-level cash flow analysis.

| Current Folder | Target Location | Notes |
|---|---|---|
| `cashflow-site-audit` | `cashflow/site-audit/` | Cashflow feature audit findings |

### 6. `ai-features` (3 features)
AI-driven features: image import, usage logging, chat.

| Current Folder | Target Location | Notes |
|---|---|---|
| `ai-image-import` | `ai-features/ai-image-import/` | **Domain HLD goes here** |
| `ai-usage-logging` | `ai-features/ai-usage-logging/` | Track AI usage |
| `finance-chat-assistant` | `ai-features/finance-chat/` | Chat-based queries |

### 7. `donations` (3 features)
Donations, zakat, and related transaction linking.

| Current Folder | Target Location | Notes |
|---|---|---|
| `donations` | `donations/donations/` | **Domain HLD goes here** |
| `donation-transaction-linking` | `donations/transaction-linking/` | Link to transactions |
| `zakat` | `donations/zakat/` | Zakat calculation |

### 8. `reimbursements` (1 feature)
Standalone reimbursement feature.

| Current Folder | Target Location | Notes |
|---|---|---|
| `reimbursements` | `reimbursements/reimbursements/` | **Domain HLD goes here** |

### 9. `user-profile` (1 feature)
User profile and preferences.

| Current Folder | Target Location | Notes |
|---|---|---|
| `user-profile` | `user-profile/user-profile/` | **Domain HLD goes here** |

### 10. `standalone` (10 features)
Miscellaneous, cross-cutting, or architectural features without strong domain affinity.

| Current Folder | Target Location | Notes |
|---|---|---|
| `calendar-attribution-architecture` | `standalone/calendar-attribution/` | Calendar-based attribution |
| `design-modernization` | `standalone/design-modernization/` | Design updates |
| `development-standards` | `standalone/development-standards/` | Code standards |
| `e2e-testing` | `standalone/e2e-testing/` | E2E test framework |
| `embedding-models-comparison` | `standalone/embedding-models/` | Embedding model eval |
| `entity-relations` | `standalone/entity-relations/` | Entity relationship analysis |
| `preferred-currency-display` | `standalone/preferred-currency/` | Currency preferences |
| `schema-naming-review` | `standalone/schema-naming/` | Naming conventions audit |
| `site-audit` | `standalone/site-audit/` | General site audit |

---

## Migration Phases

### Phase 1: Plan & Document (Complete)
- ✅ AGENTS.md updated with new structure
- ✅ spec-from-context skill updated
- ✅ spec-migration-map.md created (this file)
- ✅ Migration guide created (below)

### Phase 2: Pilot Test (Next — `transactions` domain)
Migrate 1 domain to validate structure + tooling:
- Move specs to `spec/transactions/`
- Create domain-level `hld.md`
- Refactor feature-level `context.md` + `lld.md`
- Document learnings
- Estimate time for bulk migration

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

1. **Create migration guide** (`MIGRATION_GUIDE.md`) with agent template
2. **Run pilot** on `transactions` domain using gpt-4.1 background agent
3. **Document learnings** and estimate remaining 47 features
4. **Proceed with selective migration** as features are touched

