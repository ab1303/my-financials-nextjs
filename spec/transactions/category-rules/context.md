Domain HLD: `spec/transactions/hld.md`

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

**OUT OF SCOPE:**
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
