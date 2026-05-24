# Category URL Filtering — Low-Level Design (ADR)

## Decision

**Use ID-based URL parameters (Option A) with documented upgrade path to Hybrid (Option C).**

```
/cashflow/transactions?category=<categoryId>&month=8&year=2024
```

## Decision Rationale

### Why ID-Based is Right Now

| Factor | ID-Based | Name-Based | Hybrid |
|--------|----------|-----------|--------|
| **Simplicity** | ✅ Simple | ❌ Complex encoding | ⚠️ Moderate |
| **Stability** | ✅ Immutable | ❌ Breaks on rename | ✅ Immutable |
| **Performance** | ✅ O(1) lookup | ⚠️ String match | ✅ O(1) |
| **Security** | ✅ Standard | ⚠️ False confidence | ✅ Standard |
| **URL Readability** | ❌ Not readable | ✅ Readable | ✅ Readable |
| **Implementation Effort** | ✅ 30 min | ⚠️ 45 min | ❌ 90 min |

**Winner for MVP**: ID-Based  
**Winner for production UX**: Hybrid (future upgrade)

---

## Security Model Clarification

### Common Misconception: "Don't expose IDs"

This is **false security**:

```typescript
// SECURE with ID visible (if authorization is enforced)
GET /api/transactions?categoryId=5
→ Backend: WHERE userId = currentUserId AND categoryId = 5
→ Only see own data ✅

// INSECURE with ID hidden (if authorization is missing)
GET /api/transactions?categorySlug=groceries
→ Backend: SELECT * WHERE slug = 'groceries'
→ Any user sees anyone's data ❌
```

**What ID exposure actually reveals:**
- ✓ That a resource exists
- ✓ Approximate count (if sequential: max ID ≈ total)
- ✓ Creation order
- ✗ Access to other users' data (prevented by authorization)
- ✗ System secrets, passwords, tokens

**Real security layers:**
1. Authorization (backend checks ownership)
2. Authentication (who are you?)
3. HTTPS/TLS (can't be sniffed)
4. Rate limiting (prevent enumeration attacks)

**ID visibility is NOT a security layer.**

---

## Implementation: Option A (ID-Based)

### 1. Link Builder

```typescript
// src/app/(authorized)/cashflow/expense/_components/CategoryBreakdownModal.tsx

export function buildCategoryTransactionHref(
  categoryId: string,
  month: number,
  year: number = new Date().getFullYear()
) {
  return `/cashflow/transactions?category=${encodeURIComponent(categoryId)}&month=${month}&year=${year}`;
}

// Usage:
// buildCategoryTransactionHref("cuid-12345", 8, 2024)
// → /cashflow/transactions?category=cuid-12345&month=8&year=2024
```

### 2. Server-Side Resolution

```typescript
// src/app/(authorized)/cashflow/transactions/page.tsx

export default async function TransactionsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');

  const resolvedSearchParams = await searchParams;
  let initialCategory: string | undefined;

  if (resolvedSearchParams.category) {
    // Look up category name from ID
    const category = await prisma.expenseCategory.findUnique({
      where: { id: resolvedSearchParams.category as string },
      select: { name: true },
    });
    
    if (category) {
      initialCategory = category.name;
    }
  }

  // Pass resolved name to client components
  return <TransactionsClient initialCategory={initialCategory} {...props} />;
}
```

### 3. Filter Application

The resolved category name is passed downstream to `TransactionLedgerTable`, which filters by name:

```typescript
// In TransactionLedgerTable: category state initialized with resolved name
const [category, setCategory] = useState<string | undefined>(initialCategory);

// Filter query includes category name
const queryInput = {
  category, // "Fees & Interest" (resolved from ID)
  // ...
};

// Backend filters by name
const transactions = await prisma.transaction.findMany({
  where: { userId, category, type: 'DEBIT', status: 'CONFIRMED' },
});
```

---

## Option C (Hybrid): Future Upgrade Path

When URL readability becomes important (user feedback, sharing patterns), upgrade to:

```
/cashflow/transactions?category=5-fees-interest&month=8&year=2024
```

**Full implementation guide: See `spec/architecture/category-url-filtering/upgrade-to-hybrid.md`** (not yet created; documented in comments for future implementation)

### Migration Strategy (Zero-Downtime)

1. Add `slug` field to `ExpenseCategory` schema
2. Generate slugs via migration
3. Update link builders to include slug
4. Update URL parser to extract both ID and slug
5. Validate slug matches (optional redirect)

**During migration:**
- Old URLs (`?category=5`) still work (ID used for lookup)
- New URLs (`?category=5-fees-interest`) work immediately
- Users organically migrate as they click new links

**Backward compatible**: Parser handles both formats.

---

## Implementation Checklist

- [x] Update `buildCategoryTransactionHref` to accept `categoryId`
- [x] Update caller to pass `entry.categoryId`
- [x] Update `TransactionsPage` to look up category name by ID
- [x] Verify authorization (user owns the data)
- [x] Pass resolved name to downstream components
- [x] Build succeeds with no type errors
- [x] Test end-to-end: Expense modal → Transactions filter

---

## Future Decisions (Option C Upgrade)

**When to consider Hybrid approach:**

✅ **Good reasons to upgrade:**
- User feature requests for shareable URLs
- Analytics show meaningful category patterns in logs
- Share/bookmark features are added
- Users want to share filtered views

❌ **Not good reasons:**
- "URLs look nicer" (premature optimization)
- "Other apps do it" (don't copy without need)
- "Future-proofing" (build when needed)

**Cost-benefit at decision time:**
- Implementation: ~90 minutes
- Testing: ~30 minutes
- Migration risk: Low (backward compatible)
- User value: Medium-to-High (context in URLs)

---

## References

### Security Model
- [OWASP: Exposure of Sensitive Information Through URL Parameters](https://owasp.org/www-community/attacks/OWASP_Insecure_Direct_Object_References_(IDOR))
- **Key point**: IDs in URLs are NOT an IDOR vulnerability if authorization is enforced

### Real-World Examples (All Use IDs)
- GitHub: `/owner/repo/issues/123` (IDs visible)
- Stripe: `/invoices/in_1234abc` (IDs visible)
- Linear: `/team/PRJ-123` (IDs visible)
- Twitter: `/status/1234567890` (IDs visible)

### URL Design Patterns
- [RESTful API Design Best Practices](https://restfulapi.net/resource-naming/)
- [Slug vs ID Trade-offs](https://en.wikipedia.org/wiki/Clean_URL#Slugs) — common in CMSes (WordPress, Django)

---

## Acceptance Criteria

✅ **Category ID is used in URL**  
✅ **Server resolves ID → name**  
✅ **Only category owner can filter** (authorization enforced in downstream query)  
✅ **Invalid category ID handled gracefully** (no filter applied, not an error)  
✅ **URL is stable** (won't break if category name changes)  
✅ **Hybrid upgrade path documented** (for future maintainers)  

---

## ADR Document Status

- **Date**: 2026-05-24
- **Status**: ACCEPTED (Option A implemented, Option C documented for future)
- **Author**: Copilot
- **Reviewers**: @user
- **Supercedes**: Previous string-based category filtering
- **Superceded by**: (Future) Option C (Hybrid) if/when implemented
