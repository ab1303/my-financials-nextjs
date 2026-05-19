# Business Entity Management - High-Level Design

## Feature Overview

The Business Entity Management feature allows users to create, read, and partially manage business records in the financial application. Businesses represent external entities the user transacts with (banks, charities, brokerages, etc.) and are central to tracking donations, zakat payments, bank accounts, and investment portfolios.

### Current State (Partial Implementation)
- ✅ **Create**: Users can add new businesses with name, type, and address
- ✅ **Read**: Users can list all businesses and select to view details
- ⚠️ **Update**: Button shows "Update" text, but operation still creates duplicates; true update incomplete
- ✅ **Delete**: Users can delete businesses from the select dropdown with inline delete icon
- ⚠️ **Duplicate Prevention**: Server-side constraint only; client-side warning missing

### Planned (Out of Scope for MVP)
- Delete confirmation dialog
- Full address validation (AU postcodes, state codes)
- Global address format support

---

## Data Model

### Business Entity
```
Business {
  id: String (cuid) — Primary key
  name: String — Business identifier (e.g., "Commonwealth Bank", "Red Cross")
  type: BusinessEnumType — Type: BANK, PHILANTHROPY, BROKERAGE
  addressLine: String (optional) — Additional address info
  streetAddress: String (optional) — Street address
  suburb: String (optional) — Suburb/city
  postcode: Int (optional) — 4-digit AU postcode
  state: String (optional) — AU state code (NSW, VIC, etc.)
  userId: String (FK) — Owner of business record
  createdAt: DateTime
  updatedAt: DateTime
}
```

### Enum: BusinessEnumType
- `BANK` — Financial institution (banks, credit unions)
- `PHILANTHROPY` — Charity, NGO, trust
- `BROKERAGE` — Stock broker, investment platform

---

## CRUD Flows

### 1. Create Business
1. User navigates to Business Relations page
2. Form displays with empty fields
3. User fills in: Business Name, Type (select), Address fields
4. Form validation triggered on blur (react-hook-form mode: 'onBlur')
5. On submit:
   - Client validates required fields and postcode format (4 digits)
   - Calls `trpc.business.saveBusinessDetails` mutation
   - Server validates schema and checks unique name constraint (case-insensitive)
   - If duplicate: tRPC error returned; toast displays error
   - If success: Business saved; query cache refreshed; form reset; success toast shown

### 2. Read (List) Businesses
1. Form loads; immediately queries `trpc.business.getAllBusinesses`
2. Query returns array of user's businesses
3. Results used to populate Select dropdown in form

### 3. Select & Edit Business (Partial Update)
1. User selects a business from dropdown (Option component)
2. `handleOptionChange` called; form fields populated with selected business data:
   - businessName → input field
   - type → select field
   - address → NOT populated (AddressComponent receives data prop but doesn't render it)
3. Button text changes to "Update" (visual indication only)
4. User modifies fields
5. On submit:
   - Form calls `saveBusinessDetails` (same endpoint as create)
   - Since business already exists with name, server returns CONFLICT error
   - User sees duplicate name error; update fails

### 4. Delete Business
1. User sees delete icon (trash can) next to each business in select dropdown
2. Clicking icon immediately calls `trpc.business.removeBusinessDetails` mutation
3. No confirmation dialog shown
4. On success: Query cache refreshed; success toast shown

---

## Validation Approach

### Server-Side (Source of Truth)
- **Schema validation** via Zod: presence, type, max length
- **Unique constraint**: Name must be unique per user (case-insensitive check via `getBusinessDetails`)
- **Type validation**: Must be a valid enum value
- **Address fields**: Required at schema level, but accepted as-is (no format checks)

### Client-Side (UX Only)
- **Required field checks**: Via react-hook-form required rule
- **Type constraints**: Select field limits to enum values
- **Postcode format**: Basic length check (4 digits) in form submission handler
- **No duplicate warning**: User not warned before submission

### Validation Gaps
- AU postcode must be numeric, 4 digits → not enforced on server
- AU state must be valid code → not validated on server
- Address component accepts any string for all fields
- No real-time duplicate name feedback at client level

---

## Architecture Decisions

### 1. Denormalized Address
- Address stored as individual fields on Business model (no separate Address table)
- Reduces schema complexity; easier to query
- Trade-off: Address component must handle conversion between form shape and database shape

### 2. Server-Side User Isolation
- Session user ID (`ctx.session.user.id`) injected into all mutations
- No business ID passed from client; enforces that users cannot modify other users' records
- Deletion authenticated at route level only (no per-record auth check yet)

### 3. Shared Address Component
- Single component used across Business, Individual, and other entities
- Encapsulates AU-specific validation; designed for future extensibility
- Currently, component only validates presence; no format enforcement

### 4. Client-Side Mutation Patterns
- Form submission → mutation → auto-refetch query → UI update
- Optimistic updates not implemented; mutations show loading state
- Success/error feedback via toast notifications

---

## Known Gaps (Not Resolved in Current Implementation)

| Gap | Impact | Notes |
|---|---|---|
| Update operation not implemented | Users selecting a business get "Update" button but create duplicate on submit | Forms should check for businessId from context and call updateBusinessDetails, not saveBusinessDetails |
| Client-side duplicate checking missing | Poor UX; user discovers duplicates only after form submission | Should query all business names on mount and validate real-time |
| Address fields not populated in edit flow | User must re-enter address even when selecting existing business | AddressComponent receives address prop but doesn't render it into form |
| No delete confirmation | Users can accidentally delete businesses by misclick | Should add ConfirmationDialog before delete mutation |
| Enum mismatch (frontend vs DB) | BROKERAGE option unavailable in form dropdown | Frontend enum should include BROKERAGE or it should be removed from Prisma schema |
| Address validation minimal | Invalid AU postcodes/states accepted by server | Should add postcode format validation and AU state list on server |
| No proper update mutation | Workaround: form reuses create endpoint | Should implement updateBusinessDetails tRPC mutation with proper error handling |

---

## Integration Points

### 1. tRPC API
- `trpc.business.create` — Quick-create with name only (for CreateBeneficiaryModal in donation flow)
- `trpc.business.saveBusinessDetails` — Full create with all fields
- `trpc.business.getAllBusinesses` — Fetch user's businesses
- `trpc.business.getBusinessesByType` — Filter by type (optional)
- `trpc.business.removeBusinessDetails` — Delete business

### 2. Shared Components
- **AddressComponent**: Renders address form fields; validates presence only
- **Card**: Container styling for form section
- **Button**: Submit button with loading state
- **Label, TextInput**: Form field components

### 3. External Systems
- **Database**: Prisma ORM with PostgreSQL
- **Auth**: NextAuth v5 (session provided via `ctx.session.user.id`)
- **State Management**: TanStack Query (React Query) for caching/refetching

---

## Success Criteria

✅ Implemented:
- User can create a business with all required fields
- User can list their businesses and select one
- User can delete a business
- Duplicate business names prevented at server level
- Form validation at client and server

⚠️ Partial/Incomplete:
- Edit flow shows "Update" button but creates duplicates (true update not implemented)
- Address validation minimal (format not enforced)
- Client-side duplicate detection missing

❌ Not Implemented (Future Scope):
- Delete confirmation dialog
- Full AU address validation (postcodes, state codes)
- Global address format support
- Proper update operation with businessId context
