# Individual Entity Management - Implementation Tracking

## Overview

Implementation tracking for [Individual Entity Management PRD](./individual-entity-management-prd.md) - Issue #7 (GH-009)

**Branch:** `7-gh-009-create-individual`  
**Started:** September 25, 2025  
**Estimated Completion:** 4-6 days

## Implementation Progress

### ✅ Phase 1: Database Schema & Migration (COMPLETED)

- [x] **Database Schema Extension** - Extended Individual Prisma model with address fields, unique constraints, and created Relationship model for dynamic relationship management
  - Added Relationship model with user-scoped relationships
  - Added address fields to Individual model (addressLine, streetAddress, suburb, postcode, state)
  - Added unique constraint on [name, userId] for both models
  - Added foreign key relationship between Individual and Relationship
- [x] **Database Migration** - Successfully created and applied migration `20250925045023_add_individual_relationship_models`
  - Migration resolved schema drift issues
  - All database constraints properly applied

### 🚧 Phase 2: Backend Services & API (IN PROGRESS)

- [ ] **Create Relationship Backend Services**
  - Create service layer with `addRelationship`, `getRelationships` functions for user-scoped relationship management
  - **Files to create:** `src/server/services/relationship.service.ts`
- [ ] **Create Individual Backend Services**
  - Create service layer with `addIndividualDetails`, `getIndividualDetails` functions following Business service pattern
  - **Files to create:** `src/server/services/individual.service.ts`
- [ ] **Create Individual Backend Controllers**
  - Create controller with create, read operations following Business controller pattern with uniqueness validation
  - **Files to create:** `src/server/controllers/individual.controller.ts`
- [ ] **Create Individual tRPC API**
  - Create tRPC router with `saveIndividualDetails`, `getAllIndividuals`, and relationship management procedures
  - **Files to create:** `src/server/trpc/router/individual.ts`

### 🔄 Phase 3: Validation & Schemas (PENDING)

- [ ] **Create Individual Validation Schemas**
  - Create Zod validation with required name field, optional relationship field, and address fields
  - **Files to create:** `src/server/schema/individual.schema.ts`

### 🎨 Phase 4: Frontend Implementation (PENDING)

- [ ] **Create Individual Form UI**
  - Create form component with dynamic relationship dropdown supporting create-new functionality
  - **Files to create:** `src/app/(authorized)/relation/individual/form.tsx`
- [ ] **Create Individual Page Structure**
  - Create page component and integrate with app navigation following Business page pattern
  - **Files to create:** `src/app/(authorized)/relation/individual/page.tsx`

## Technical Context

### Database Schema

```prisma
model Relationship {
  id          String       @id @default(cuid())
  name        String       // e.g., "Mother", "Father", "Friend"
  userId      String
  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  individuals Individual[]
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  @@unique([name, userId])
}

model Individual {
  id             String        @id @default(cuid())
  name           String
  relationshipId String?
  relationship   Relationship? @relation(fields: [relationshipId], references: [id])
  // Address fields + user relation + unique constraints
  @@unique([name, userId])
}
```

### Reference Implementation Patterns

- **Business Entity Management**: `src/app/(authorized)/relation/business/` - Complete CRUD with type classification, address integration, react-select with custom options
- **Address Component**: `src/components/Address.tsx` - Shared component with Google Places autocomplete
- **tRPC Pattern**: `src/server/trpc/router/business.ts` - API structure to follow

### Key Requirements from PRD

1. **Individual Name**: Required, unique per user (case-insensitive validation)
2. **Relationship Field**: Optional, dynamic dropdown with create-new capability, 150-char limit
3. **Address Fields**: Optional, using shared Address component
4. **User Scoping**: All data scoped to logged-in user
5. **Form Behavior**: "Create" vs "Update" button text, form pre-population on edit

## Next Steps

1. **Start with Relationship services** - Core to dropdown functionality
2. **Follow Business entity patterns** - Maintain consistency
3. **Implement in order** - Services → Controllers → tRPC → Validation → UI

## AI Agent Context Notes

- This is Issue #7 from GitHub: "Create individual" (GH-009)
- PRD available at: `spec/individual-entity-management-prd.md`
- Database migration already applied: `20250925045023_add_individual_relationship_models`
- Reference implementations in `src/app/(authorized)/relation/business/` directory
- Using T3 Stack: Next.js 13+ App Router, tRPC, Prisma, Tailwind CSS
- Address component shared across Bank, Business, and Individual entities
