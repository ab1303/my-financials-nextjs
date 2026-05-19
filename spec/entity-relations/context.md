# Business Entity Management - Context

## File Inventory

### Frontend Components
- `src/app/(authorized)/relation/business/page.tsx` — Page wrapper; renders BusinessForm component
- `src/app/(authorized)/relation/business/form.tsx` — Main form component with select/create/update/delete flows

### Backend
- `src/server/trpc/router/business.ts` — tRPC router with procedures: `create`, `saveBusinessDetails`, `getAllBusinesses`, `getBusinessesByType`, `removeBusinessDetails`
- `src/server/schema/business.schema.ts` — Zod validation schemas: `createBusinessSchema`, `params`
- `src/server/controllers/business.controller.ts` — Business logic handlers
- `src/server/services/business.service.ts` — Database query helpers

### Database & Types
- `prisma/schema.prisma` — Prisma Business model (lines 153–171)
- `src/types/enum.ts` — BusinessEnumType export

### Shared Components
- `src/components/AddressComponent.tsx` — Shared address input component

---

## Business Model Structure

### Database Schema (Prisma)
```prisma
enum BusinessEnumType {
  BANK
  PHILANTHROPY
  BROKERAGE
}

model Business {
  id                String               @id @default(cuid())
  name              String
  addressLine       String?
  streetAddress     String?
  suburb            String?
  postcode          Int?
  state             String?
  type              BusinessEnumType?
  userId            String
  user              User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  // Relations to DonationPayment, ZakatPayment, BankAccount, BankInterestPayment, etc.
  createdAt         DateTime             @default(now())
  updatedAt         DateTime             @updatedAt
}
```

### TypeScript Enum (Frontend & Server)
```typescript
export const BusinessEnumType = {
  BANK: 'BANK',
  PHILANTHROPY: 'PHILANTHROPY',
} as const;
export type BusinessEnumType =
  (typeof BusinessEnumType)[keyof typeof BusinessEnumType];
```

**Note**: Enum in `src/types/enum.ts` has only `BANK` and `PHILANTHROPY`. The actual Prisma schema includes `BROKERAGE`. This is a discrepancy to be addressed.

### Form Type
```typescript
type BusinessType = {
  businessName: string;
  type: BusinessEnumType;
  address: {
    addressLine: string;
    street_address: string;
    suburb: string;
    postcode: string;
    state: string;
  };
};
```

---

## Relationships to Other Entities

### Business → Address (via AddressComponent)
- Address data stored as individual fields in Business model: `addressLine`, `streetAddress`, `suburb`, `postcode`, `state`.
- No separate Address model; data denormalized on Business.
- AddressComponent handles form rendering and validation at UI level.

### Business → User
- Each Business linked to a User via `userId`.
- User can have multiple Business records.
- User isolation enforced at query level (context.session.user.id).

### Business → Financial Records
- Business referenced by `DonationPayment` (donations made to/by business).
- Business referenced by `ZakatPayment` (zakat paid to/by business).
- Business referenced by `BankAccount` (bank accounts held with this business).
- Business referenced by `BankInterestPayment` and `BankInterestLiability` (interest tracking).
- Business referenced by `StockHolding` (investment accounts with business).

---

## Current Implementation Gaps & Limitations

### 1. Enum Type Mismatch
- Frontend enum (`src/types/enum.ts`) defines: `BANK`, `PHILANTHROPY`
- Prisma schema defines: `BANK`, `PHILANTHROPY`, `BROKERAGE`
- Frontend only populates two values; BROKERAGE option not available in form

### 2. Update Flow Not Properly Wired
- Form button shows "Update" text when a business is selected from dropdown
- However, no update mutation is called; form still calls `saveBusinessDetails` (create endpoint)
- No UPDATE operation in backend router; only CREATE and DELETE
- Selecting a business, modifying it, and submitting creates a duplicate instead of updating

### 3. Client-Side Duplicate Checking Missing
- Unique business name constraint enforced only on server
- No client-side validation to warn user before submission
- User must submit form to discover duplicate name error

### 4. Address Validation Minimal
- AU postcode validation: only checks length (4 digits) at form submission level
- No server-side postcode format validation
- No server-side state validation (AU state list exists at form level, not enforced on server)
- Address component does minimal validation; no state dropdown, no postcode length check

### 5. Select-to-Edit Flow Incomplete
- Selecting a business from dropdown populates form fields
- Address fields not populated (address data passed to component but not rendered into form fields)
- User must manually re-enter address even though it was already provided

### 6. No Delete Confirmation
- Delete icon in select dropdown triggers mutation immediately
- No confirmation dialog; user can accidentally delete by misclick

---

## Validation Architecture

### Server-Side Validation
- **Schema**: `createBusinessSchema` validates presence, type, and max length of fields
- **Unique constraint**: tRPC `create` endpoint checks for duplicate names (case-insensitive)
- **No postcode format check**: Accepts any number 0–9999
- **No state validation**: Accepts any string

### Client-Side Validation
- **Form-level**: React Hook Form with required field checks
- **Address component**: Field presence validation only
- **No duplicate checking**: User not warned of duplicates before submission
- **No postcode format validation**: Not enforced at input level

---

## Known TODOs (from implementation)

1. **Proper Update Operation**: Implement `updateBusinessDetails` tRPC mutation and wire form to use it when editing
2. **Client-Side Duplicate Detection**: Query all business names on form load and warn user in real-time
3. **Delete Confirmation Dialog**: Add confirmation before deletion
4. **Address Population in Edit Flow**: Ensure AddressComponent receives and displays address fields when business is selected
5. **Enum Alignment**: Add BROKERAGE to frontend enum or remove from Prisma schema
6. **Address Validation**: Implement AU state dropdown and strict postcode validation (4 digits, numeric only)
