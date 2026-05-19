# Business Entity Management - Low-Level Design

## API Specifications (tRPC)

### 1. Create Business (Quick)
**Endpoint**: `trpc.business.create`  
**Access**: Protected (authenticated users only)

#### Input Schema
```typescript
z.object({
  name: z.string().min(1, 'Name is required')
})
```

#### Behavior
- Checks for duplicate name (case-insensitive)
- Sets type to 'PHILANTHROPY' by default
- Returns `{ id, name }` for quick-create flows (e.g., CreateBeneficiaryModal)

#### Error Handling
- `CONFLICT` (409): Duplicate name exists
- `UNAUTHORIZED` (401): User not authenticated

---

### 2. Save Business Details (Full Create)
**Endpoint**: `trpc.business.saveBusinessDetails`  
**Access**: Protected  

#### Input Schema
```typescript
object({
  name: string({ required_error: 'Business Name is required' })
    .max(100, 'Business Name must be less than 100 characters'),
  type: z.nativeEnum(BusinessEnumType, {
    required_error: 'Business type is required',
    invalid_type_error: 'Invalid business type',
  }),
  addressLine: string({ required_error: 'Address line is required' }),
  streetAddress: string({ required_error: 'Street address is required' }),
  postcode: number({ required_error: 'Postcode is required' })
    .max(9999),
  state: string({ required_error: 'State is required' }),
  suburb: string({ required_error: 'Suburb is required' }),
})
```

#### Behavior
- Calls `addBusinessDetailsHandler({ input, userId })`
- Handler invokes `addBusinessDetails` service
- Service saves Business record with user context
- Query cache refreshed on client via `refetchQueries`

#### Return Value
```typescript
Promise<Business> // Full saved Business object
```

#### Limitations
- ⚠️ No duplicate name check; relies on CREATE handler to enforce uniqueness
- ⚠️ No update operation; re-submitting same name fails at create level
- ⚠️ No DELETE operation wired to this endpoint

---

### 3. Get All Businesses
**Endpoint**: `trpc.business.getAllBusinesses`  
**Access**: Protected  

#### Input
None

#### Behavior
- Calls `allBusinessDetailsHandler(userId)`
- Returns all businesses for authenticated user
- Used to populate Select dropdown in form

#### Return Value
```typescript
Promise<Business[]>
```

---

### 4. Get Businesses by Type
**Endpoint**: `trpc.business.getBusinessesByType`  
**Access**: Protected  

#### Input Schema
```typescript
z.object({ type: z.string().optional() }).optional()
```

#### Behavior
- Calls `getBusinessesByTypeHandler(userId, type)`
- Filters businesses by type (optional)

#### Return Value
```typescript
Promise<Business[]>
```

---

### 5. Remove Business Details
**Endpoint**: `trpc.business.removeBusinessDetails`  
**Access**: Protected  

#### Input Schema
```typescript
object({
  businessId: string({ required_error: 'business id is required' })
})
```

#### Behavior
- Calls `removeBusinessDetailsHandler({ params: input })`
- Deletes business by ID
- ⚠️ No ownership check; deletion enforced only at query level

#### Return Value
```typescript
Promise<{ success: boolean }>
```

#### Error Handling
- `NOT_FOUND` (404): Business not found
- `UNAUTHORIZED` (401): User not authenticated

---

## Database Schema

### Business Model
```prisma
model Business {
  id            String               @id @default(cuid())
  name          String
  addressLine   String?
  streetAddress String?
  suburb        String?
  postcode      Int?
  state         String?
  type          BusinessEnumType?
  
  // Relations
  userId        String
  user          User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  bankInterestPayments      BankInterestPayment[]
  bankInterestLiabilities   BankInterestLiability[]
  zakatPayments             ZakatPayment[]
  donationPayments          DonationPayment[]
  bankAccounts              BankAccount[]
  stockHoldings             StockHolding[]
  
  createdAt     DateTime             @default(now())
  updatedAt     DateTime             @updatedAt
  
  // Constraints
  // ⚠️ No unique constraint on (name, userId); enforced in handler logic only
}
```

### BusinessEnumType Enum
```prisma
enum BusinessEnumType {
  BANK
  PHILANTHROPY
  BROKERAGE
}
```

**Discrepancy**: Frontend enum (`src/types/enum.ts`) only exports `BANK` and `PHILANTHROPY`. When form renders, BROKERAGE option is missing from select dropdown.

---

## Validation Schema (Zod)

### createBusinessSchema
```typescript
const createBusinessSchema = object({
  name: string({ required_error: 'Business Name is required' })
    .max(100, 'Business Name must be less than 100 characters'),
  type: z.nativeEnum(BusinessEnumType, {
    required_error: 'Business type is required',
    invalid_type_error: 'Invalid business type',
  }),
  addressLine: string({ required_error: 'Address line is required' }),
  streetAddress: string({ required_error: 'Street address is required' }),
  postcode: number({ required_error: 'Postcode is required' })
    .max(9999),
  state: string({ required_error: 'State is required' }),
  suburb: string({ required_error: 'Suburb is required' }),
});
```

### Validation Gaps
- Postcode: Accepts 0–9999; no enforcement that it's 4 digits exactly
- State: Any string accepted; no validation against AU state list
- Name: Checked at handler level for duplicates, not schema level
- Address: Presence checked, but format/validity not validated

---

## Form & Component Structure

### BusinessForm Component (`src/app/(authorized)/relation/business/form.tsx`)

#### State Management
```typescript
const [selectedBusiness, setSelectedBusiness] = useState<
  SingleValue<BusinessOptionType> | undefined
>();
```
- Tracks which business is selected from dropdown for edit flow

#### Form Type
```typescript
type BusinessType = {
  businessName: string;
  type: BusinessEnumType;
  address: {
    addressLine: string;
    street_address: string;
    suburb: string;
    postcode: string; // Note: string in form, converted to number in mutation
    state: string;
  };
};
```

#### Key Functions

**resetForm()**
- Clears all form fields and selected business
- Called after successful submission

**submitHandler(formData)**
- Validates postcode format (must be 4-digit number)
- Parses postcode via `postCodeSchema.parse(postcode)`
- Calls `saveBusinessDetailsMutation.mutate()`
- On success: form reset, success toast shown
- On error: error toast shown (no form state update)

**handleOptionChange(option)**
- Called when user selects or clears a business from dropdown
- Populates form fields from selected business data
- ⚠️ Does not populate address fields; AddressComponent doesn't render them
- Sets button text to "Update" (visual only; still calls create mutation)

#### Rendering

**Select Dropdown**
- Lists all businesses with custom Option component
- Each option has inline delete icon (DeleteIcon)
- Clicking delete immediately triggers remove mutation (no confirmation)

**Form Fields**
1. Business (Select) — Select existing business or create new
2. Business Name (TextInput) — Name of the business
3. Business Type (select) — Dropdown with `Object.values(BusinessEnumType)`
4. Address Component — Shared component for address fields

**Address Component Props**
```typescript
<AddressComponent<BusinessType>
  basePropertyName='address'
  address={selectedBusiness?.value.address}
  addressFields={{
    addressLineName: 'address.addressLine',
    postcodeName: 'address.postcode',
    stateName: 'address.state',
    street_addressName: 'address.street_address',
    suburbName: 'address.suburb',
    addressLineError: errors.address?.addressLine,
    suburbError: errors.address?.suburb,
    postcodeError: errors.address?.postcode,
    stateError: errors.address?.state,
    street_addressError: errors.address?.street_address,
  }}
/>
```

#### Mutations

**saveBusinessDetailsMutation**
- Calls `trpc.business.saveBusinessDetails.useMutation()`
- On success: refetch `['business', 'getAllBusinesses']` query
- On error: show toast with error message

**deleteBusiness (in Option component)**
- Calls `trpc.business.removeBusinessDetails.useMutation()`
- On success: refetch query, show success toast
- On error: show error toast

---

## Known TODOs & Implementation Gaps

### 1. Update Operation Not Implemented
```typescript
// Current: Form reuses create endpoint
const submitHandler = (formData: BusinessType) => {
  saveBusinessDetailsMutation.mutate({ ...formData });
  // ⚠️ When editing, this creates duplicate instead of updating
};

// TODO: Implement updateBusinessDetails tRPC mutation
trpc.business.updateBusinessDetails.useMutation();
// And wire:
const submitHandler = (formData: BusinessType) => {
  if (selectedBusiness?.id) {
    updateBusinessDetailsMutation.mutate({ businessId: selectedBusiness.id, ...formData });
  } else {
    saveBusinessDetailsMutation.mutate(formData);
  }
};
```

### 2. Client-Side Duplicate Detection Missing
```typescript
// TODO: Check for duplicate name before submit
const checkDuplicateName = (name: string) => {
  return businessOptions.some(
    (b) => b.label.toLowerCase() === name.toLowerCase()
  );
};
// Call on form change; show error if duplicate found
```

### 3. Address Population in Edit Flow
```typescript
// AddressComponent receives prop but doesn't render it
// TODO: Update AddressComponent to populate fields from address prop
const [addressData, setAddressData] = useState(selectedBusiness?.value.address);
useEffect(() => {
  if (selectedBusiness?.value.address) {
    formFieldSetValue('address.street_address', selectedBusiness.value.address.street_address);
    // ... set all address fields
  }
}, [selectedBusiness]);
```

### 4. Delete Confirmation Dialog
```typescript
// TODO: Show confirmation before delete
const handleDeleteClick = async (businessId: string) => {
  const confirmed = await showConfirmation(
    'Delete Business',
    `Are you sure you want to delete this business?`
  );
  if (confirmed) {
    deleteBusiness({ businessId });
  }
};
```

### 5. Enum Alignment
```typescript
// TODO: Update frontend enum to match Prisma schema
// File: src/types/enum.ts
export const BusinessEnumType = {
  BANK: 'BANK',
  PHILANTHROPY: 'PHILANTHROPY',
  BROKERAGE: 'BROKERAGE', // Add this
} as const;
```

### 6. Server-Side Address Validation
```typescript
// TODO: Add validators in createBusinessSchema
postcode: number()
  .min(1000, 'Postcode must be 4 digits')
  .max(9999, 'Postcode must be 4 digits'),
state: z.enum(['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT']),
```

### 7. Query-Level User Ownership Check
```typescript
// TODO: Verify businessId belongs to requesting user in removeBusinessDetailsHandler
const business = await db.business.findUnique({ where: { id: businessId } });
if (business?.userId !== userId) {
  throw new TRPCError({ code: 'UNAUTHORIZED' });
}
```

---

## Error Messages & Status Codes

| Scenario | Code | Message |
|----------|------|---------|
| Duplicate business name | CONFLICT (409) | "A business with this name already exists." |
| Missing required field | BAD_REQUEST (400) | "{fieldName} is required" |
| Invalid type enum | BAD_REQUEST (400) | "Invalid business type" |
| Business not found (delete) | NOT_FOUND (404) | "Business not found" |
| Unauthorized (not logged in) | UNAUTHORIZED (401) | "Unauthorized" |

---

## Data Flow Diagram

```
[User] 
  → [BusinessForm]
    → [Select Dropdown] (getAllBusinesses query)
      → [Option Component with Delete Icon]
        → removeBusinessDetails mutation
    → [Business Name Input]
    → [Type Select] (Object.values(BusinessEnumType))
    → [AddressComponent]
  → [Submit Button]
    → saveBusinessDetails mutation
    → ↓
[tRPC Router (business.ts)]
  → saveBusinessDetailsHandler
    → addBusinessDetails service
      → [Prisma Business.create]
        → [PostgreSQL Business table]

[On Delete]
  → removeBusinessDetails mutation
    → removeBusinessDetailsHandler
      → [Prisma Business.delete]
        → [PostgreSQL Business table]
```

---

## Performance Considerations

- **Query caching**: `getAllBusinesses` cached by React Query; refetched after mutations
- **No pagination**: Form loads all businesses; fine for typical user (< 100 businesses)
- **Select dropdown search**: Supported by react-select component; no backend search needed
- **Lazy field validation**: Validation on blur (react-hook-form mode: 'onBlur'); no real-time server checks

---

## Security Considerations

✅ Implemented:
- User ID injected from session; users cannot see/modify other users' businesses
- All endpoints protected with `protectedProcedure` (auth required)
- Enum validation prevents invalid type values

⚠️ Missing:
- Per-record ownership check in delete handler (relies on query-level filtering)
- No rate limiting on delete operations
- Postcode validation could leak valid AU postcodes to attackers (low risk)

❌ Not Applicable:
- No file uploads
- No public endpoints
