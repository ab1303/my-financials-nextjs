# Business (Philanthropy) Contacts — Low-Level Design

## Phase Map

| Phase                              | Status      |
|-------------------------------------|-------------|
| CRUD PHILANTHROPY Businesses       | ✅ BUILT     |
| Form Validation (Zod)              | ✅ BUILT     |
| Update Business (Edit)             | ✅ BUILT (2026-05-31) |

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

export const updateBusinessSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  addressLine: z.string().optional(),
  streetAddress: z.string().optional(),
  suburb: z.string().optional(),
  postcode: z.coerce.number().int().optional(),
  state: z.string().optional(),
  // type is NOT included — business type cannot change after creation
});
```

## TDD Test Cases

| Test                                 | Type    | Verifies                                      |
|--------------------------------------|---------|-----------------------------------------------|
| Create PHILANTHROPY business         | unit    | Business is created, required fields present   |
| Prevent duplicate name per user      | unit    | Unique constraint on (name, userId) enforced   |
| Update business                      | unit    | updateBusinessDetails calls prisma.update      |
| validateBusinessNameUniqueness       | unit    | Returns false when duplicate exists, excludes self on update |

## File Inventory

| File                                                        | Status   | Description                                 |
|-------------------------------------------------------------|----------|---------------------------------------------|
| src/app/(authorized)/relation/business/page.tsx             | ✅ BUILT | Page shell for business contacts            |
| src/app/(authorized)/relation/business/form.tsx             | ✅ BUILT | Client form — create + update with conditional mutation |
| src/server/trpc/router/business.ts                          | ✅ BUILT | tRPC router — saveBusinessDetails, updateBusinessDetails, removeBusinessDetails |
| src/server/controllers/business.controller.ts               | ✅ BUILT | addBusinessDetailsHandler, updateBusinessDetailsHandler, removeBusinessDetailsHandler |
| src/server/services/business.service.ts                     | ✅ BUILT | addBusinessDetails, updateBusinessDetails, validateBusinessNameUniqueness |
| src/server/schema/business.schema.ts                        | ✅ BUILT | createBusinessSchema (optional address fields), updateBusinessSchema |
| src/__tests__/unit/business.service.test.ts                 | ✅ BUILT | 9 unit tests covering create, uniqueness validation, update |
