# Individual Contacts — Low-Level Design

## Phase Map

| Phase                        | Status      |
|------------------------------|-------------|
| CRUD Individual Contacts     | ✅ BUILT     |
| CRUD Relationship Types      | ✅ BUILT     |
| Form Validation (Zod)        | ✅ BUILT     |

## Key TypeScript Interfaces

```typescript
export interface Individual {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  relationshipId?: string;
  addressLine?: string;
  streetAddress?: string;
  suburb?: string;
  postcode?: number;
  state?: string;
  addressFormat?: string; // "AU"
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface RelationshipType {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}
```

## Key Zod Schemas

```typescript
import { z } from 'zod';

export const individualSchema = z.object({
  name: z.string().min(1),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  relationshipId: z.string().optional(),
  addressLine: z.string().optional(),
  streetAddress: z.string().optional(),
  suburb: z.string().optional(),
  postcode: z.coerce.number().int().optional(),
  state: z.string().optional(),
});

export const relationshipTypeSchema = z.object({
  name: z.string().min(1),
});
```

## TDD Test Cases

| Test                                 | Type    | Verifies                                      |
|--------------------------------------|---------|-----------------------------------------------|
| Create individual with valid data     | unit    | Individual is created, required fields present |
| Prevent duplicate name per user       | unit    | Unique constraint on (name, userId) enforced   |
| Add new relationship type            | unit    | User can add custom relationship label         |

## File Inventory

| File                                                        | Status   | Description                                 |
|-------------------------------------------------------------|----------|---------------------------------------------|
| src/app/(authorized)/relation/individual/page.tsx           | ✅ BUILT | Page shell for individual contacts          |
| src/app/(authorized)/relation/individual/form.tsx           | ✅ BUILT | Client form for add/edit individual         |
| src/app/(authorized)/relation/individual/layout.tsx         | ✅ BUILT | Layout for individual contacts route        |
| src/server/trpc/router/individual.ts                        | ✅ BUILT | tRPC router for individuals & relationships |
