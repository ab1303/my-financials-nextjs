# Phase Map

| Phase | Description | Status |
|-------|-------------|--------|
| 1     | Schema & Model: Add `CategoryRule` model, enum, and User relation | ✅ Done |
| 2     | Service & Router: CRUD, findSimilar, runCategoryRules, applyToPast | ✅ Done |
| 3     | UX: Inline prompt, drawer, TransactionRow integration | ✅ Done |
| 4     | Management Page: List, toggle, delete rules, navigation | ✅ Done |
| 5     | Performance: pg_trgm index + DB-push refactor | ✅ Done |

---

## 1. Schema & Model

**Prisma additions:**
```prisma
enum CategoryRuleMatchType {
  CONTAINS
  STARTS_WITH
  EXACT
}

model CategoryRule {
  id           String                @id @default(cuid())
  userId       String
  user         User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  name         String
  matchType    CategoryRuleMatchType @default(CONTAINS)
  pattern      String
  category     String
  isActive     Boolean               @default(true)
  appliedCount Int                   @default(0)
  createdAt    DateTime              @default(now())
  updatedAt    DateTime              @updatedAt

  @@index([userId, isActive])
}
```

**User model addition:**
```prisma
// In model User
categoryRules CategoryRule[]
```

---

## 2. Service & Router

**TypeScript Interfaces:**
```typescript
// src/server/services/transactions/category-rule.service.ts
export interface CategoryRuleInput {
  pattern: string;
  matchType: 'CONTAINS' | 'STARTS_WITH' | 'EXACT';
  category: string;
  name: string;
  userId: string;
}

export interface FindSimilarInput {
  userId: string;
  description: string;
  excludeTransactionId?: string;
}
```

**Zod Schemas:**
```typescript
import { z } from 'zod';

export const categoryRuleInputSchema = z.object({
  pattern: z.string().min(1),
  matchType: z.enum(['CONTAINS', 'STARTS_WITH', 'EXACT']),
  category: z.string().min(1),
  name: z.string().min(1),
  userId: z.string().cuid(),
});

export const findSimilarInputSchema = z.object({
  userId: z.string().cuid(),
  description: z.string().min(1),
  excludeTransactionId: z.string().cuid().optional(),
});
```

**Function Signatures:**
```typescript
// Service
async function createRule(input: CategoryRuleInput): Promise<CategoryRule>;
async function listRules(userId: string): Promise<CategoryRule[]>;
async function toggleRule(ruleId: string, isActive: boolean): Promise<void>;
async function deleteRule(ruleId: string): Promise<void>;
async function findSimilarTransactions(input: FindSimilarInput): Promise<number>;
async function runCategoryRules({ prisma, userId, importSessionId }: { prisma: PrismaClient, userId: string, importSessionId: string }): Promise<void>;
async function applyRuleToPast(ruleId: string, userId: string): Promise<number>;

// tRPC router
categoryRule.create: (input: CategoryRuleInput) => CategoryRule
categoryRule.list: (userId: string) => CategoryRule[]
categoryRule.toggle: (ruleId: string, isActive: boolean) => void
categoryRule.delete: (ruleId: string) => void
categoryRule.findSimilar: (input: FindSimilarInput) => number
categoryRule.applyToPast: (ruleId: string, userId: string) => number
```

---

## 3. UX: Prompt, Drawer, Row Integration

**Interfaces:**
```typescript
// src/components/transactions/CategoryRulePrompt.tsx
export interface CategoryRulePromptProps {
  count: number;
  onCreate: () => void;
  onDismiss: () => void;
}

// src/components/transactions/CategoryRuleDrawer.tsx
export interface CategoryRuleDrawerProps {
  open: boolean;
  initialPattern: string;
  initialCategory: string;
  initialName: string;
  onClose: () => void;
  onSubmit: (input: CategoryRuleInput, applyToPast: boolean) => void;
}
```

**Zod Schema:**
```typescript
export const categoryRuleDrawerSchema = z.object({
  pattern: z.string().min(1),
  matchType: z.enum(['CONTAINS', 'STARTS_WITH', 'EXACT']),
  category: z.string().min(1),
  name: z.string().min(1),
  applyToPast: z.boolean(),
});
```

---

## 4. Management Page

**Interfaces:**
```typescript
// src/app/(authorized)/cashflow/category-rules/_components/CategoryRulesTable.tsx
export interface CategoryRulesTableProps {
  rules: CategoryRule[];
  onToggle: (ruleId: string, isActive: boolean) => void;
  onDelete: (ruleId: string) => void;
}
```

---

## TDD Test Cases

### Phase 1: Schema & Model
| Test | Type | Verifies |
|------|------|----------|
| Creates CategoryRule with valid data | unit | Model saves and retrieves correctly |
| Enforces userId relation | unit | Cascade delete on user removal |
| Index on userId/isActive | integration | Query performance and correctness |

### Phase 2: Service & Router
| Test | Type | Verifies |
|------|------|----------|
| createRule persists rule | unit | Rule is saved and returned |
| findSimilarTransactions returns correct count | unit | Similarity logic works |
| runCategoryRules applies rules on import | integration | Transactions updated as expected |

### Phase 3: UX
| Test | Type | Verifies |
|------|------|----------|
| Prompt appears for ≥2 similar | integration | UI triggers prompt correctly |
| Drawer pre-fills pattern/category | unit | Drawer receives correct initial values |
| onRuleCreated callback fires | integration | Parent notified on rule creation |

### Phase 4: Management Page
| Test | Type | Verifies |
|------|------|----------|
| Rules list renders | unit | Table displays all rules |
| Toggle active state | integration | Rule toggling updates state |
| Delete removes rule | integration | Rule is deleted and UI updates |

---

## Schema Migration Notes
- Add `CategoryRuleMatchType` enum and `CategoryRule` model to `prisma/schema.prisma`
- Add `categoryRules CategoryRule[]` to User model
- Create migration: `pnpm prisma migrate dev --name category-rule-model`

---

## 5. Performance: pg_trgm Index + DB-Push Refactor

### Migration
Add to `Transaction` model in `schema.prisma`:
```prisma
@@index([description(ops: raw("gin_trgm_ops"))], type: Gin)
```

The `pg_trgm` extension is installed via a separate raw SQL migration (`add_description_trgm_index`).
The index itself is fully Prisma-managed as of migration `add_description_trgm_index_managed` —
no drift detection issues on subsequent `migrate dev` runs.

### buildDescriptionFilter helper (service)
Shared helper that maps `CategoryRuleMatchType` → Prisma filter object.
Eliminates the duplicated JS `includes` / `startsWith` / `===` logic that existed
in both `runCategoryRules` and `applyRuleToPast`:
```typescript
function buildDescriptionFilter(matchType: CategoryRuleMatchType, pattern: string) {
  if (matchType === CategoryRuleMatchType.STARTS_WITH)
    return { startsWith: pattern, mode: 'insensitive' as const };
  if (matchType === CategoryRuleMatchType.EXACT)
    return { equals: pattern, mode: 'insensitive' as const };
  return { contains: pattern, mode: 'insensitive' as const };
}
```

### applyRuleToPast refactor
Before: loaded ALL non-voided transactions into Node.js memory, matched in JS loop.
After: single `prisma.transaction.updateMany` with DB-level `WHERE description LIKE ...`

### runCategoryRules refactor
Before: loaded all import session transactions, ran N×M double-loop in JS.
After: one `prisma.transaction.updateMany` per rule — DB handles matching.

### findSimilar debounce (TransactionRow)
Added 400ms debounce via `useRef<ReturnType<typeof setTimeout>>` in `handleChange`.
Added guard: skips `findSimilar` call if `newCategory === transaction.category` (no real change).

---

## File Inventory
| File | Action | Description |
|------|--------|-------------|
| prisma/schema.prisma | MODIFY | Add `CategoryRuleMatchType` enum, `CategoryRule` model; add `categoryRules CategoryRule[]` to User |
| prisma/migrations/20260524121110_category_rule_model/migration.sql | CREATE | Auto-generated: CategoryRule table, enum, index |
| prisma/migrations/20260524130550_add_description_trgm_index/migration.sql | CREATE | Raw SQL: `CREATE EXTENSION IF NOT EXISTS pg_trgm` |
| prisma/migrations/20260524130857_add_description_trgm_index_managed/migration.sql | CREATE | Prisma-managed: `CREATE INDEX ... USING GIN (description gin_trgm_ops)` |
| src/server/services/transactions/category-rule.service.ts | CREATE | `createRule`, `listRules`, `toggleRule`, `deleteRule`, `findSimilarTransactions`, `runCategoryRules`, `applyRuleToPast`, `buildDescriptionFilter` |
| src/server/trpc/router/category-rule.ts | CREATE | tRPC router: `create`, `list`, `toggle`, `delete`, `findSimilar`, `applyToPast` |
| src/server/trpc/router/_app.ts | MODIFY | Register `categoryRule: categoryRuleRouter` |
| src/components/transactions/CategoryRulePrompt.tsx | CREATE | Inline banner: "X similar found. Save as rule?" with Create Rule + Dismiss |
| src/components/transactions/CategoryRuleDrawer.tsx | CREATE | Rule creation drawer: pattern (editable), matchType select, category (pre-filled), name, scope (future / future+past) |
| src/components/transactions/TransactionRow.tsx | MODIFY | After `handleChange`: debounced `findSimilar` call (400ms, skip if same category), render `CategoryRulePrompt` when count ≥ 2 |
| src/app/(authorized)/cashflow/category-rules/page.tsx | CREATE | Server Component: fetch rules, render `CategoryRulesTable` |
| src/app/(authorized)/cashflow/category-rules/_components/CategoryRulesTable.tsx | CREATE | Client Component: list rules, toggle active, delete |
| src/app/(authorized)/cashflow/transactions/_components/TransactionsClient.tsx | MODIFY | Add Category Rules link button alongside Transfer Rules |
| src/layouts/SideNav.tsx | MODIFY | Add `{ name: 'Category Rules', href: '/cashflow/category-rules', icon: Tag }` to cashflowItems |
| src/app/api/transactions/csv/confirm/route.ts | MODIFY | Call `runCategoryRules` after `runTransferMatchRules` |
