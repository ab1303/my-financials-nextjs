# Category Management Low-Level Design

## Phase Map
| Phase                | Files                                                      | Description                                 | Depends On         |
|----------------------|-----------------------------------------------------------|---------------------------------------------|-------------------|
| List Categories      | page.tsx, CategoriesClient.tsx                            | Show all categories in tabs                 | -                 |
| CRUD Income Source   | tRPC router, CategoriesClient.tsx, _schema.ts             | Add/edit/delete income sources              | List Categories   |
| CRUD Expense Category| tRPC router, CategoriesClient.tsx, _schema.ts             | Add/edit/delete expense categories          | List Categories   |
| List Special Cats    | tRPC router, CategoriesClient.tsx                         | Show special categories (read-only)         | List Categories   |
| Backend Logic        | trpc/router/income-source.ts, trpc/router/expense-category.ts, trpc/router/special-category.ts | Data access, validation, system cat logic   | All UI phases     |

## Key TypeScript Interfaces
```typescript
export interface IncomeSource {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  description?: string;
  iconName?: string;
  isActive: boolean;
}

export interface SpecialCategory {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  isEditable: boolean;
  color?: string;
}
```

## Key Zod Schemas
```typescript
import { z } from 'zod';

export const incomeSourceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export const expenseCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  iconName: z.string().optional(),
});
```

## TDD Test Cases
| Test                        | Type    | Verifies                                 |
|-----------------------------|---------|------------------------------------------|
| Add income source           | unit    | Source is created and listed             |
| Edit expense category       | unit    | Category updates and persists            |
| Special cat not editable    | unit    | Edit/delete disabled for isEditable=false |

## File Inventory
| File                                         | Status   | Description                                 |
|----------------------------------------------|----------|---------------------------------------------|
| page.tsx                                    | ✅ BUILT | Renders CategoriesClient                    |
| _components/CategoriesClient.tsx             | ✅ BUILT | Client component with tabs                  |
| _schema.ts                                  | 🔧 MODIFY| Add/adjust Zod schemas for categories       |
| trpc/router/income-source.ts                 | ✅ BUILT | tRPC router for income sources              |
| trpc/router/expense-category.ts              | ✅ BUILT | tRPC router for expense categories          |
| trpc/router/special-category.ts              | ✅ BUILT | tRPC router for special categories          |