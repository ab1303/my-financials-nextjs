Domain HLD: `spec/transactions/hld.md`

## Implementation Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Schema & Model | ✅ Done — migration `20260524121110_category_rule_model` |
| 2 | Service & Router | ✅ Done — `category-rule.service.ts`, `category-rule.ts` router |
| 3 | UX: Prompt, Drawer, Row Integration | ✅ Done — `CategoryRulePrompt`, `CategoryRuleDrawer`, `TransactionRow` |
| 4 | Management Page | ✅ Done — `/cashflow/category-rules/`, SideNav, TransactionsClient |
| 5 | Performance: pg_trgm index + DB-push refactor | ✅ Done — migration `add_description_trgm_index` |

**Scalability hardening (delivered in Phase 5):**
- `applyRuleToPast`: replaced full in-memory scan with single `updateMany` DB query
- `runCategoryRules`: replaced N×M in-memory loop with one `updateMany` per rule
- `findSimilar`: added 400ms debounce + same-category guard in `TransactionRow`
- `buildDescriptionFilter`: shared helper mapping match type → Prisma filter (eliminates duplicated JS matching logic)
- `pg_trgm` GIN index on `Transaction.description`: enables fast ILIKE pattern matching at scale

**Deferred to Phase 2 Scope:**
- Cursor-based pagination for the transaction ledger — see `spec/phase2-scope/transaction-ledger/`

---

## Problem Summary

Users frequently need to manually re-categorize recurring transactions that are misclassified by the LLM. There is no memory of prior corrections, so users must repeat the same fix for every occurrence. This feature introduces a `CategoryRule` model and smart UX to automate and streamline category corrections for recurring transactions.

## Domain Dependencies
- Transaction enrichment is separate from the immutable ledger (see spec/transactions/hld.md, Architecture Decision #8)
- Follows the user-scoped rule pattern established by `TransferMatchRule`
- Integrates with Transaction, User, and import flows

## Scope
**IN SCOPE:**
- `CategoryRule` model and enum
- Inline prompt to save rule after category change (≥2 similar transactions)
- Rule creation drawer with pattern/matchType/category
- Rule application on CSV import (post-confirm)
- Management page at `/cashflow/category-rules/`
- Navigation and linking in SideNav and TransactionsClient
- `pg_trgm` GIN index on `Transaction.description` for performant ILIKE pattern matching

**OUT OF SCOPE (deferred to Phase 2):**
- Cursor-based pagination to eliminate `COUNT(*)` overhead — see `spec/phase2-scope/transaction-ledger/`

**OUT OF SCOPE (no plan):**
- Amount/type/bank account-based rules
- Rule priority/conflict resolution
- AI-assisted rule naming
- Bulk editing outside import

## Existing Patterns to Reuse
- Service and router structure from `TransferMatchRule`
- Management page UI from `/cashflow/transfer-rules/`
- Drawer and prompt UI patterns from existing transaction components

## Known Constraints
- All rules are user-scoped (`userId`)
- Prompt only triggers for ≥2 similar transactions with different categories
- Drawer defaults: pattern = first 3 words (lowercased), matchType = CONTAINS
- Must not mutate the immutable transaction ledger; enrichment only
- Dark mode required for all color utilities
- `pg_trgm` extension may require superuser on first install; safe on Render.com and standard Postgres
