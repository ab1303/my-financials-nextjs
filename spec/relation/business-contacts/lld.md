# Business (Philanthropy) Contacts — Low-Level Design

## Phase Map

| Phase                              | Status      |
|-------------------------------------|-------------|
| CRUD PHILANTHROPY Businesses       | ✅ BUILT     |
| Form Validation (Zod)              | ✅ BUILT     |

## Key TypeScript Interfaces

```typescript
export interface Business {
  id: string;
  name: string;
  addressLine?: string;
  streetAddress?: string;
  suburb?: string;
  postcode?: number;
  state?: string;
  type?: 'PHILANTHROPY';
  userId: string;
  createdAt: string;
  updatedAt: string;
}
```

## Key Zod Schemas

```typescript
import { z } from 'zod';

export const businessSchema = z.object({
  name: z.string().min(1),
  addressLine: z.string().optional(),
  streetAddress: z.string().optional(),
  suburb: z.string().optional(),
  postcode: z.coerce.number().int().optional(),
  state: z.string().optional(),
});
```

## TDD Test Cases

| Test                                 | Type    | Verifies                                      |
|--------------------------------------|---------|-----------------------------------------------|
| Create PHILANTHROPY business         | unit    | Business is created, required fields present   |
| Prevent non-PHILANTHROPY creation    | unit    | Only PHILANTHROPY type allowed for user        |
| Prevent duplicate name per user      | unit    | Unique constraint on (name, userId) enforced   |

## File Inventory

| File                                                        | Status   | Description                                 |
|-------------------------------------------------------------|----------|---------------------------------------------|
| src/app/(authorized)/relation/business/page.tsx             | ✅ BUILT | Page shell for business contacts            |
| src/app/(authorized)/relation/business/form.tsx             | ✅ BUILT | Client form for add/edit business           |
| src/server/trpc/router/business.ts                          | ✅ BUILT | tRPC router for business contacts           |
