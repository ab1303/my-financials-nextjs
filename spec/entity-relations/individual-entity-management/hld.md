# Individual Entity Management - High-Level Design

## Feature Overview

Individual Entity Management enables users to create, read, update, and delete (CRUD) individual records for financial tracking and relationship management. Each individual is uniquely identified per user and can be tagged with relationship types (e.g., Mother, Father, Friend). The feature mirrors existing Business Details functionality and includes optional address support in both Australian and global formats.

**Key Correction from Original PRD**: Individual deletion functionality **is implemented** in the current codebase, contrary to the PRD's non-goals section.

## Goals

### Business Goals
- Enable users to manage individual records efficiently for financial tracking and relationship management
- Ensure data consistency and prevent duplicate individual entries per user
- Provide flexible relationship management with user-specific relationship options
- Lay the groundwork for future address support across different geographical regions

### User Goals
- Add new individuals with required details (name) and optional details (firstName, lastName, address information)
- Edit and update existing individual information
- Select from existing relationships or create new relationship types dynamically
- Delete individuals when no longer needed
- Maintain organized records of individuals for financial and personal tracking

### Technical Goals
- Enforce user-scoped data isolation at API layer
- Maintain unique individual names per user via database constraints
- Support flexible address formats (AU-specific and global)
- Integrate seamlessly with existing Address and AddressComponent

## Data Model

### Individual Entity
```
Individual {
  id: String (CUID, primary key)
  name: String (required, unique per user)
  firstName: String (optional)
  lastName: String (optional)
  relationshipId: String (optional, foreign key to RelationshipType)
  addressFormat: String (default "AU", values: "AU" or "GLOBAL")
  
  // Address fields (all optional)
  addressLine: String (for GLOBAL format complete address)
  streetAddress: String (for AU format)
  suburb: String (for AU format)
  postcode: Int (for AU format, range 1000-9999)
  state: String (for AU format)
  
  userId: String (foreign key to User, cascade delete)
  createdAt: DateTime
  updatedAt: DateTime
  
  Relationships:
  - RelationshipType (optional, many Individuals to one RelationshipType)
  - User (required, many Individuals to one User)
  - ZakatPayment[] (for charitable giving)
  - DonationPayment[] (for donations)
  
  Constraints:
  - @@unique([name, userId]) - case-sensitive at DB level
}
```

### Relationship Model
```
RelationshipType {
  id: String (CUID, primary key)
  name: String (e.g., "Mother", "Father", "Friend")
  userId: String (scoped to user)
  
  Relationships:
  - Individual[] (one-to-many inverse relation)
  - User (many-to-one)
}
```

## CRUD Flows

### Create (Create New Individual)
1. User navigates to `/relation/individual`
2. Form is empty and ready for data entry
3. User enters:
   - Individual Name (required, 1-100 characters)
   - FirstName (optional, max 50)
   - LastName (optional, max 50)
   - Relationship (optional, CreatableSelect dropdown)
   - Address Format selector (AU or GLOBAL, default AU)
   - Address fields (all optional based on format)
4. On submit:
   - Client validates individual name uniqueness (case-insensitive check against dropdown list)
   - Server validates uniqueness via `validateIndividualNameUniqueness` service
   - If relationship name is new, creates RelationshipType record
   - Creates Individual record with userId from session
   - Refetches individuals and relationships lists
   - Shows success toast
   - Form resets

### Read (View Individuals)
1. Form displays dropdown of all individuals for current user (via `getAllIndividuals` tRPC query)
2. Individuals listed as selectable options in dropdown
3. User can filter/search individuals in dropdown

### Update (Edit Individual)
1. User selects individual from dropdown
2. Form auto-populates with individual's data:
   - Individual Name, FirstName, LastName
   - Relationship (if assigned)
   - Address format and fields
3. Button label changes to "Update"
4. User modifies fields as needed
5. On submit:
   - Server validates name uniqueness (excluding current individual's ID)
   - If relationship changed, creates or updates RelationshipType
   - Updates Individual record with new data
   - Refetches individuals and relationships
   - Shows success toast
   - Form remains populated (user can continue editing)

### Delete (Remove Individual)
1. User selects individual from dropdown
2. Delete icon appears next to individual name in dropdown
3. User clicks delete icon
4. Calls `removeIndividualDetails` tRPC mutation
5. Individual record deleted from database
6. Refetches individuals and relationships lists
7. Shows success toast "Individual details deleted successfully"
8. Form resets

## Unique Name Constraint

**Enforcement**:
- **Database Level**: `@@unique([name, userId])` constraint in Prisma schema
- **Case Sensitivity**: Database-level constraint is case-sensitive
- **Application Logic**: Service layer performs case-insensitive comparison using lowercase normalization
- **Validation**: Applied to both create and update operations (update excludes current record)

**Error Handling**:
- Create attempt with duplicate name: "An individual with this name already exists. Individual names must be unique."
- Update attempt with duplicate name: Same error message
- Returned to user via toast notification

## Address/AddressFormat Support

**Format Selection**:
- User selects addressFormat before entering address details
- Default: "AU"
- Options: "AU" (Australian) or "GLOBAL" (for other regions)

**AU Format**:
- Structured fields: streetAddress, suburb, postcode (Int), state
- Uses AddressComponent with AU-specific validation
- Postcode must be 4-digit number (1000-9999)

**GLOBAL Format**:
- Single freeform text field: addressLine
- Allows user to enter complete address as text
- No structured validation

**Data Handling**:
- addressFormat stored as string in Individual.addressFormat
- AU format data: stored in streetAddress, suburb, postcode, state
- GLOBAL format data: stored in addressLine
- Switch between formats: fields not applicable to selected format remain empty

## Relationship Management

**Workflow**:
1. User can select from existing relationships in CreatableSelect dropdown
2. If relationship doesn't exist, user can type new relationship name
3. On form submission with new relationship:
   - Service checks if relationship exists for user
   - If not, creates new RelationshipType record
   - Links Individual to relationship via relationshipId
4. Created relationships persist and appear in future dropdown options

**Design**:
- Relationships are user-scoped (private)
- Relationship field is optional
- Multiple individuals can share same relationship type
- Prevents duplicate relationship names per user

## Out of Scope

- Advanced individual attributes (tax information, detailed contact info)
- Global relationship sharing across users
- Bulk operations (import, export, mass delete)
- Individual archival or soft delete

## Decisions

**Why Database-Level Unique Constraint?**
- Ensures data integrity even if application logic is bypassed
- Prevents race conditions in concurrent operations
- Database-enforced constraints are more reliable than application-level validation alone

**Why Case-Insensitive in App but Case-Sensitive in DB?**
- Better UX: prevents users from creating "John" and "john" separately
- Database case-sensitivity preserved for flexibility and performance
- Application layer enforces business rule

**Why Optional Relationship?**
- Some individuals may not fit standard relationship categories
- Relationship can be added/modified later without blocking individual creation
- Supports flexible use cases (transactional contacts, entities, etc.)

**Why Separate addressFormat Instead of Polymorphic?**
- Simple and explicit: enum-like behavior without full data modeling complexity
- Easy to add new formats in future
- Clear separation of concerns (structured vs. freeform)
