# Donations — Low Level Design

## Concrete Data Model
The canonical `Donation` concept is implemented as a fiscal-year header plus row records.

### `DonationLedger`
```prisma
model DonationLedger {
  id         String            @id @default(cuid())
  calendar   CalendarYear      @relation(fields: [calendarId], references: [id])
  calendarId String            @unique
  payments   DonationPayment[]
}
```

### `DonationPayment`
```prisma
model DonationPayment {
  id               String              @id @default(cuid())
  datePaid         DateTime
  amount           Decimal             @db.Money
  beneficiaryType  BeneficiaryEnumType
  taxCategory      String
  businessId       String?
  individualId     String?
  donationLedgerId String
  transactionId    String?             @unique
  donationPurpose  DonationPurposeEnum @default(VOLUNTARY)
}
```

### Key Enums
- `BeneficiaryEnumType` — `INDIVIDUAL | BUSINESS`
- `DonationPurposeEnum` — `VOLUNTARY | INTEREST_CLEANSING`

## Server Contracts

### Service Layer
- `addDonationCalendarYearDetails()` — creates the year header on demand.
- `getDonation()` — fetches the header for a fiscal year.
- `getDonationPayments()` — fetches row records plus beneficiary relations.
- `getTotalDonations()` — aggregates fiscal-year totals.
- `addDonationPaymentDetail()` / `updateDonationPayment()` / `deleteDonationPayment()` — row CRUD.

### Controllers and Actions
- `createDonationYearHandler()` ensures a `DonationLedger` exists before a write.
- `totalDonationsHandler()` wraps aggregate reads for the page.
- `addRow()`, `editRow()`, and `deleteRow()` validate input, enforce auth, mutate, and `revalidatePath('/cashflow/donations')`.

### Validation
- `CreateDonationPaymentSchema`
- `UpdateDonationPaymentSchema`
- `DeleteDonationPaymentSchema`
- Form input requires valid date, positive amount, beneficiary selection, and tax category.

## UI Composition

1. `page.tsx` resolves the selected fiscal year and total donations.
2. `form.tsx` owns year selection and total display.
3. `DonationTableServer.tsx` fetches payment rows server-side.
4. `DonationTableClient.tsx` renders TanStack Table rows with inline editing.
5. `StateProvider.tsx` + `reducer.ts` hold edit-row and loading state.
6. `_components/` contain enrichment and beneficiary helpers such as `UnlinkedTransactionsBanner`, `LinkTransactionsDrawer`, and `CreateBeneficiaryModal`.

## File Inventory

| File | Role |
|---|---|
| `prisma/schema.prisma` | `DonationLedger`, `DonationPayment`, enums, optional `transactionId` relation |
| `src/server/services/donation.service.ts` | Donation header creation, totals, and payment CRUD |
| `src/server/controllers/donation.controller.ts` | Year/header and total read helpers |
| `src/app/(authorized)/cashflow/donations/actions.ts` | Authenticated server actions for row mutations |
| `src/app/(authorized)/cashflow/donations/page.tsx` | Server page orchestration |
| `src/app/(authorized)/cashflow/donations/form.tsx` | Fiscal-year filter and totals UI |
| `src/app/(authorized)/cashflow/donations/DonationTableServer.tsx` | Server-side table data fetch |
| `src/app/(authorized)/cashflow/donations/DonationTableClient.tsx` | Inline-editing table client |
| `src/app/(authorized)/cashflow/donations/StateProvider.tsx` | Context provider for donation table state |
| `src/app/(authorized)/cashflow/donations/reducer.ts` | Reducer actions for edit and loading state |
| `src/app/(authorized)/cashflow/donations/_schema.ts` | Zod schemas and inferred input types |
| `src/app/(authorized)/cashflow/donations/_types.ts` | `DonationType`, `DonationPaymentType`, server action types |
| `src/app/(authorized)/cashflow/donations/_components/UnlinkedTransactionsBanner.tsx` | Banner for imported but unlinked donation transactions |
| `src/app/(authorized)/cashflow/donations/_components/LinkTransactionsDrawer.tsx` | Drawer UI for transaction enrichment |
| `src/app/(authorized)/cashflow/donations/_components/CreateBeneficiaryModal.tsx` | Inline beneficiary creation flow |

## Migration Note
This feature consolidates the former flat donations spec and implementation notes into the donations domain structure; this file is now the canonical implementation inventory.

## Notes for Future Changes
- `DonationLedger` is the concrete schema name, but the feature should still be discussed as the donations workflow at the product level.
- Transaction linking is intentionally optional so manual donation entry remains valid.
- File inventory stays here to keep `context.md` focused on scope and dependencies.
