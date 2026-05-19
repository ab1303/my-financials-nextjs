# Individual Entity Management - Low-Level Design

## API Specifications (tRPC Router)

### Endpoint: `individual.create`
**Purpose**: Quick-create individual with name only (used by CreateBeneficiaryModal in donation linking)

**Input**:
```typescript
{
  name: string (required, min 1 character)
}
```

**Output**:
```typescript
{
  id: string
  name: string
}
```

**Process**:
1. Accepts name only
2. Creates Individual with addressFormat defaulted to 'AU'
3. Returns created individual ID and name
4. Used for rapid individual creation in other features

---

### Endpoint: `individual.saveIndividualDetails`
**Purpose**: Create new individual with full details

**Input** (Zod Schema: `createIndividualSchema`):
```typescript
{
  name: string (required, 1-100 chars, trimmed)
  firstName?: string (optional, max 50 chars)
  lastName?: string (optional, max 50 chars)
  relationshipName?: string (optional, max 150 chars, trimmed)
  addressFormat?: string (optional, 'AU' | 'GLOBAL', default 'AU')
  addressLine?: string (optional, max 500 chars for GLOBAL)
  streetAddress?: string (optional, max 200 chars for AU)
  suburb?: string (optional, max 100 chars for AU)
  postcode?: number (optional, range 1000-9999 for AU)
  state?: string (optional, max 20 chars for AU)
}
```

**Output**:
```typescript
{
  status: 'success'
  data: {
    individual: {
      id: string
      name: string
      firstName?: string
      lastName?: string
      relationshipId?: string
      addressFormat?: string
      addressLine?: string
      streetAddress?: string
      suburb?: string
      postcode?: number
      state?: string
      userId: string
      createdAt: DateTime
      updatedAt: DateTime
    }
  }
}
```

**Validation & Processing**:
1. Validate all fields against schema
2. Check individual name uniqueness per user (case-insensitive)
3. If relationshipName provided:
   - Call `getOrCreateRelationship(relationshipName, userId)`
   - Returns relationship ID
4. Create Individual record with user context from session
5. Return created individual

**Error Handling**:
- TRPCError if name not unique: "An individual with this name already exists. Individual names must be unique."
- TRPCError for validation failures
- Generic server error for unexpected issues

---

### Endpoint: `individual.updateIndividualDetails`
**Purpose**: Update existing individual with full details

**Input** (Zod Schema: `updateIndividualSchema`):
```typescript
{
  id: string (required, individual ID)
  name?: string (optional, 1-100 chars if provided, trimmed)
  firstName?: string (optional, max 50 chars)
  lastName?: string (optional, max 50 chars)
  relationshipName?: string (optional, max 150 chars, trimmed)
  addressFormat?: string (optional, 'AU' | 'GLOBAL')
  addressLine?: string (optional, max 500 chars)
  streetAddress?: string (optional, max 200 chars)
  suburb?: string (optional, max 100 chars)
  postcode?: number (optional, range 1000-9999)
  state?: string (optional, max 20 chars)
}
```

**Output**:
```typescript
{
  status: 'success'
  data: {
    individual: { /* same structure as saveIndividualDetails output */ }
  }
}
```

**Validation & Processing**:
1. Validate all fields against schema
2. If name provided and different from current:
   - Check uniqueness per user excluding current individual (case-insensitive)
3. If relationshipName provided:
   - If non-empty: call `getOrCreateRelationship` to get/create relationship
   - If empty: clear relationship (set to null)
4. Update Individual record with provided fields only (partial update)
5. Return updated individual

**Error Handling**:
- TRPCError if name not unique: "An individual with this name already exists. Individual names must be unique."
- TRPCError for validation failures

---

### Endpoint: `individual.removeIndividualDetails`
**Purpose**: Delete individual record

**Input** (Zod Schema: `params`):
```typescript
{
  individualId: string (required)
}
```

**Output**:
```typescript
// void / success response
```

**Process**:
1. Validate individualId is provided
2. Call `deleteIndividualDetails(individualId)`
3. Delete Individual record from database

**Error Handling**:
- Generic error handling via `handleCaughtError`

---

### Endpoint: `individual.getAllIndividuals`
**Purpose**: Fetch all individuals for current user

**Input**: None

**Output**:
```typescript
Individual[] // Array of all individuals for logged-in user
```

**Process**:
1. Extract userId from session context
2. Query all Individual records where userId matches
3. Return sorted array (order TBD in service layer)

**Error Handling**:
- Generic error handling

---

### Endpoint: `individual.getAllRelationships`
**Purpose**: Fetch all relationship types for current user

**Input**: None

**Output**:
```typescript
RelationshipType[] // Array of all relationship types for logged-in user
```

**Process**:
1. Extract userId from session context
2. Query all RelationshipType records where userId matches
3. Return array

**Error Handling**:
- Generic error handling

---

## Database Schema

### Individual Table

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String (CUID) | PRIMARY KEY | Auto-generated unique identifier |
| name | String | NOT NULL, UNIQUE(name, userId) | Required, case-sensitive at DB (app enforces case-insensitive) |
| firstName | String | NULL | Optional first name |
| lastName | String | NULL | Optional last name |
| relationshipId | String | NULL, FOREIGN KEY | References RelationshipType.id |
| addressFormat | String | DEFAULT 'AU' | 'AU' or 'GLOBAL' |
| addressLine | String | NULL | For GLOBAL format complete address |
| streetAddress | String | NULL | For AU format street |
| suburb | String | NULL | For AU format suburb |
| postcode | Int | NULL | For AU format, range 1000-9999 |
| state | String | NULL | For AU format state |
| userId | String | NOT NULL, FOREIGN KEY | References User.id, ONDELETE CASCADE |
| createdAt | DateTime | DEFAULT NOW() | Record creation timestamp |
| updatedAt | DateTime | AUTO UPDATE | Record last update timestamp |

**Indexes**:
- `@@unique([name, userId])` - Composite unique on name and userId

**Relations**:
- Individual.relationshipId → RelationshipType.id (optional many-to-one)
- Individual.userId → User.id (required many-to-one, cascade delete)
- Individual ← ZakatPayment[] (one-to-many, beneficiary reference)
- Individual ← DonationPayment[] (one-to-many, beneficiary reference)

---

## Validation Schemas (Zod)

### createIndividualSchema
```typescript
object({
  name: string({ required_error: 'Individual Name is required' })
    .min(1, 'Individual Name is required')
    .max(100, 'Individual Name must be less than 100 characters')
    .trim(),
  firstName: optional(
    string().max(50, 'First Name must be less than 50 characters')
  ),
  lastName: optional(
    string().max(50, 'Last Name must be less than 50 characters')
  ),
  relationshipName: optional(
    string().max(150, 'Relationship must be less than 150 characters').trim()
  ),
  addressFormat: optional(
    string().refine(
      (val) => val === 'AU' || val === 'GLOBAL',
      'Address format must be either AU or GLOBAL'
    )
  ).default('AU'),
  addressLine: optional(
    string().max(500, 'Address line must be less than 500 characters')
  ),
  streetAddress: optional(
    string().max(200, 'Street address must be less than 200 characters')
  ),
  suburb: optional(
    string().max(100, 'Suburb must be less than 100 characters')
  ),
  postcode: optional(number().min(1000).max(9999)),
  state: optional(
    string().max(20, 'State must be less than 20 characters')
  ),
})
```

### updateIndividualSchema
Same as createIndividualSchema with all fields optional (except id which is added):
```typescript
object({
  id: string({ required_error: 'Individual ID is required' }),
  // ... all other fields optional
})
```

---

## Form Component Specifications

### Component: `IndividualForm` (Client Component)

**Location**: `src/app/(authorized)/relation/individual/form.tsx`

**Props**: None (self-contained, uses tRPC hooks)

**State**:
```typescript
selectedIndividual: SingleValue<IndividualOptionType> | undefined
selectedRelationship: SingleValue<RelationshipOptionType> | undefined
addressFormat: 'AU' | 'GLOBAL'
```

**Form Data Structure** (react-hook-form):
```typescript
type IndividualType = {
  individualName: string
  relationshipName?: string
  firstName?: string
  lastName?: string
  address: {
    addressLocation?: 'AU' | 'GLOBAL'
    addressLine: string
    street_address: string
    suburb: string
    postcode: string
    state: string
  }
}
```

**Dropdowns**:
1. **Individual Select**: 
   - Type: `react-select` Select component
   - Options from `trpc.individual.getAllIndividuals` query
   - Option format: `{ value: IndividualType, label: string, id: string }`
   - Custom Option component with delete icon
   - On select: populate form fields, change button to "Update"
   - On clear: reset form

2. **Relationship Select**:
   - Type: CreatableSelect component
   - Options from `trpc.individual.getAllRelationships` query
   - Option format: `{ value: string, label: string, id: string }`
   - Allows creating new relationship names
   - On change: update selectedRelationship state

**Address Format Selector**:
- Type: Simple select or radio buttons
- Options: "AU" (default), "GLOBAL"
- On change: show/hide respective address fields

**Address Fields**:
- **AU Format** (conditional render):
  - Street Address (text input)
  - Suburb (text input)
  - Postcode (number input, 1000-9999)
  - State (text input)
- **GLOBAL Format** (conditional render):
  - Address Line (textarea, free-form text)

**Form Fields** (all using react-hook-form register):
- Individual Name (required, text input)
- First Name (optional, text input)
- Last Name (optional, text input)
- Relationship (optional, CreatableSelect)
- Address Format (AU/GLOBAL selector)
- Address fields (conditional based on format)

**Submission**:
- Button label: "Create" (new) or "Update" (editing)
- On submit: 
  - If selectedIndividual: call `updateIndividualDetailsMutation`
  - If no selectedIndividual: call `saveIndividualDetailsMutation`
  - On success: reset form, show toast
  - On error: show error toast with error message

**Reset**:
- Clear all form fields to defaults
- Clear selectedIndividual
- Clear selectedRelationship
- Reset addressFormat to 'AU'
- Reset address fields

---

## Delete Flow Specifications

### UI Delete Interface

**Trigger**: Delete icon in Individual select dropdown option

**Component**: Custom Option component in form.tsx
```typescript
function Option(props: OptionProps<IndividualOptionType, false>) {
  return (
    <div className='flex justify-between'>
      <BaseOption {...props} /> {/* Standard option display */}
      {isPending ? (
        <Loader2 className='animate-spin' /> {/* Loading state */}
      ) : (
        <DeleteIcon onClick={() => deleteIndividual(...)} /> {/* Delete button */}
      )}
    </div>
  )
}
```

**DeleteIcon Styling**:
- Red color (text-red-500)
- Hover effect (text-red-700)
- Cursor pointer
- Trash can SVG icon (lucide-react or inline)
- Aria-label: "Delete individual"

### Delete API Call

**tRPC Mutation**: `trpc.individual.removeIndividualDetails`

```typescript
const { isPending, mutate: deleteIndividual } =
  trpc.individual.removeIndividualDetails.useMutation({
    onSuccess() {
      // Refetch individuals list
      queryClient.refetchQueries({
        queryKey: [['individual', 'getAllIndividuals']],
      })
      // Refetch relationships list (in case relationship became orphaned)
      queryClient.refetchQueries({
        queryKey: [['individual', 'getAllRelationships']],
      })
      toast.success('Individual details deleted successfully')
    },
    onError(error) {
      toast.error(error.message)
    },
  })
```

**Input**:
```typescript
{ individualId: string }
```

### Delete Processing

1. User clicks delete icon on individual in dropdown
2. `isPending` set to true, icon shows loading spinner
3. Mutation called with `{ individualId: selectedIndividual.id }`
4. Server calls `removeIndividualDetailsHandler` → `deleteIndividualDetails`
5. Individual record deleted from database
6. On success:
   - Both individuals and relationships lists refetched
   - Success toast shown
   - Dropdown updated to remove deleted individual
7. On error:
   - Error toast shown with error message
   - Individual remains in dropdown (failed deletion)

---

## Service Layer Specifications

### Individual Service Functions

**validateIndividualNameUniqueness(name: string, userId: string, excludeId?: string): Promise<boolean>**
- Performs case-insensitive uniqueness check
- Fetches all individuals for user
- Compares lowercase names
- Excludes specific ID when provided (for update operations)
- Returns true if name is unique, false otherwise

**addIndividualDetails(data: CreateIndividualInput & { userId: string }): Promise<Individual>**
- Creates new Individual record
- Stores all address fields appropriately based on format
- Returns created record

**updateIndividualDetails(id: string, data: Partial<Individual>): Promise<Individual>**
- Updates Individual record with provided fields
- Returns updated record

**deleteIndividualDetails(id: string): Promise<void>**
- Deletes Individual record by ID

**getIndividualDetails(options: { userId: string }): Promise<Individual[]>**
- Fetches all individuals for user
- Returns sorted array (TBD sort order)

### Relationship Service Functions

**getOrCreateRelationship(name: string, userId: string): Promise<RelationshipType>**
- Checks if relationship exists for user with exact name match
- If exists: returns existing relationship
- If not: creates new RelationshipType record with name and userId
- Returns relationship record

**getRelationships(options: { userId: string }): Promise<RelationshipType[]>**
- Fetches all relationships for user
- Returns array
