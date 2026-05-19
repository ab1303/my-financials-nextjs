# Individual Entity Management - Context

## File Inventory

### Frontend Implementation
- **`src/app/(authorized)/relation/individual/page.tsx`** - Main page component, displays form and header
- **`src/app/(authorized)/relation/individual/form.tsx`** - Complete Individual CRUD form with react-hook-form, CreatableSelect for relationships, delete functionality, and AddressComponent integration

### Backend Services & Controllers
- **`src/server/controllers/individual.controller.ts`** - Controllers for CRUD operations: create, update, delete, fetch all (all user-scoped)
- **`src/server/services/individual.service.ts`** - Database service layer for Individual queries and mutations
- **`src/server/services/relationship.service.ts`** - Relationship lookup and creation (used by Individual form)

### API & Validation
- **`src/server/trpc/router/individual.ts`** - tRPC router exposing: `create`, `saveIndividualDetails`, `updateIndividualDetails`, `removeIndividualDetails`, `getAllIndividuals`, `getAllRelationships`
- **`src/server/schema/individual.schema.ts`** - Zod validation schemas for create/update operations and URL params

### Database
- **`prisma/schema.prisma`** - Individual model with fields: id, name, firstName, lastName, relationshipId, addressFormat, addressLine, streetAddress, suburb, postcode, state, userId, createdAt, updatedAt
- Relationship: One-to-one optional RelationshipType via relationshipId
- User relation via userId (Cascade delete)
- Unique constraint: `@@unique([name, userId])`

## Individual Model Structure

**Prisma Model** (see `prisma/schema.prisma`):
```prisma
model Individual {
  id               String            @id @default(cuid())
  name             String            // Required, unique per user (case-sensitive at DB level)
  firstName        String?
  lastName         String?
  relationshipId   String?
  relationship     RelationshipType? @relation(fields: [relationshipId], references: [id])
  addressLine      String?
  streetAddress    String?
  suburb           String?
  postcode         Int?
  state            String?
  addressFormat    String?           @default("AU")
  userId           String
  user             User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  zakatPayments    ZakatPayment[]
  donationPayments DonationPayment[]
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  @@unique([name, userId])
}
```

**Validation Schema** (see `src/server/schema/individual.schema.ts`):
- `createIndividualSchema`: name (required, 1-100 chars), firstName (optional, max 50), lastName (optional, max 50), relationshipName (optional, max 150), addressFormat (optional, 'AU'|'GLOBAL', default 'AU'), address fields (addressLine, streetAddress, suburb, postcode as number 1000-9999, state - all optional)
- `updateIndividualSchema`: same as create with all fields optional

## Relationship Component Structure

**RelationshipType Model** (Prisma):
- Stores user-scoped relationship types (Mother, Father, Friend, Spouse, etc.)
- Linked to Individual via relationshipId

**Form Handling**:
- CreatableSelect dropdown populated from `trpc.individual.getAllRelationships`
- User can select existing or type new relationship
- On save: new relationships are created via `getOrCreateRelationship` service
- Relationship field is optional and tagged on Individual record

## Routing & Navigation

**Route**: `/relation/individual` (not `/settings`)
- **Page Component**: `src/app/(authorized)/relation/individual/page.tsx`
- **Form Component**: Nested in same directory, `form.tsx`

## Delete Flow

**UI**:
- Delete icon displayed as option in IndividualOptionType custom Option component (react-select)
- Icon appears on hover in dropdown

**API**:
- tRPC mutation: `trpc.individual.removeIndividualDetails` takes `individualId` as input
- Calls `removeIndividualDetailsHandler` which invokes `deleteIndividualDetails` service

**Behavior**:
- Deletion is implemented (contrary to original PRD non-goals)
- Form refetches all individuals and relationships after successful delete
- Toast notification: "Individual details deleted successfully"

## Address Format Support

- **addressFormat**: String field, default "AU"
- **AU Format**: Uses structured fields (streetAddress, suburb, postcode as Int, state)
- **GLOBAL Format**: Uses addressLine for free-form address text
- Address component renders different field layouts based on addressFormat selection
- All address fields optional, form submission works with or without address data

## Key Implementation Notes

- **User Scoping**: All endpoints enforce session-based user context; users cannot access/modify others' records
- **Unique Name Constraint**: Database-level `@@unique([name, userId])` is case-sensitive (application enforces case-insensitive validation via lowercase comparison in service)
- **Address Component**: Shared component used across Bank, Business, Individual entities
- **Relationship Persistence**: Created relationships persist and appear in future dropdown options for same user
- **Form State Management**: Uses react-hook-form with FormProvider for nested address object handling
- **Delete Implementation**: Originally listed as non-goal in PRD but implemented in current codebase
