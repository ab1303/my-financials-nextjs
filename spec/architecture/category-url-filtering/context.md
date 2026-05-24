# Category URL Filtering — Context

## Problem Statement

When users filter transactions by category from the Expense modal, the system needs to pass the category reference through the URL. This raises architectural questions:

1. **How should categories be referenced in URLs?**
   - By database ID (numeric/UUID)?
   - By human-readable name (string)?
   - By slug (ID + readable)?

2. **Is exposing database IDs a security risk?**
   - Misconception: ID visibility ≠ authorization bypass
   - Reality: Security = authorization enforcement + ID obscurity ≠ security

3. **What's the best balance between stability, performance, and UX?**
   - Stability: URLs shouldn't break if data changes
   - Performance: Lookup should be O(1) or better
   - UX: URLs should be shareable/bookmarkable

## Current Problem

Previous implementation passed category names in URLs:
```
/cashflow/transactions?category=Fees%20%26%20Interest
```

**Issues:**
- Encoding fragility (spaces, special characters, case sensitivity)
- Breaks if category name is edited → dangling links
- String matching complexity in filtering
- Non-standard (most apps use IDs)

## Goals

1. **Choose correct URL model** — ID vs Name vs Hybrid tradeoff
2. **Document security rationale** — Clarify why ID exposure is safe
3. **Enable future upgrades** — Design decision should support migration to slug-based URLs
4. **Establish pattern** — Should apply to other resources (transactions, accounts, etc.) consistently

## Scope

### In Scope
- URL parameter naming and format for category filtering
- Category reference resolution (ID → name lookup)
- Security model for URL parameters
- Authorization enforcement
- Future upgrade path to slug-based URLs (Option C)

### Out of Scope
- Category creation/management UI
- Category naming validation
- Database schema changes (unless Option C is chosen)
- Other resource types (handled separately per domain)

## Key Stakeholders

- **Frontend**: Needs stable, predictable URL format for linking
- **Backend**: Must validate and authorize category access
- **Analytics**: Wants meaningful category names in logs/URLs
- **Security**: Must ensure authorization is enforced regardless of URL format
- **Users**: Want shareable URLs with context (future UX improvement)

## Related Decisions

- **Entity Relationships** (spec/architecture/entity-relations): Category model structure
- **Development Standards** (spec/architecture/development-standards): URL parameter naming conventions
- **Security Model**: Authorization checks are separate from URL parameter format

## Open Questions

1. Should we optimize for URL readability now (hybrid approach) or defer to later?
2. Should the slug-based approach (Option C) be standardized across all resource types?
3. When should we migrate existing bookmarks/links (if ever)?
