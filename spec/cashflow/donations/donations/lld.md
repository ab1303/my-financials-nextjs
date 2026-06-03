# Donations - Low Level Design

## Concrete Data Model
The canonical `DonationRecord` concept is implemented as a fiscal-year header plus row records.

### `DonationLedger`
```prisma
model DonationLedger {
  id         String       @id @default(cuid())
  calendar   CalendarYear @relation(fields: [calendarId], references: [id])
  calendarId String       @unique
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
  businessId       String?
  individualId     String?
  donationLedgerId String
  transactionId    String?             @unique
  donationPurpose  DonationPurposeEnum @default(VOLUNTARY)
}
```

### Key Enums
- `BeneficiaryEnumType` - `INDIVIDUAL | BUSINESS`
- `DonationPurposeEnum` - `VOLUNTARY | INTEREST_CLEANSING`

### Tax Logic
- If the selected beneficiary is a registered DGR, the payment is deductible.
- If the selected beneficiary is not DGR-registered, the payment is non-deductible.
- Donation purpose does not change deductibility.
- The UI should render DGR status as a read-only derived indicator.

## Server Contracts

### Service Layer
- `addDonationCalendarYearDetails()` - creates the year header on demand.
- `getDonation()` - fetches the header for a fiscal year.
- `getDonationPayments()` - fetches row records plus beneficiary relations.
- `getDonationTotals()` - returns fiscal-year totals broken down by purpose and deductible status.
- `addDonationPaymentDetail()` / `updateDonationPayment()` / `deleteDonationPayment()` - row CRUD.

### Controllers and Actions
- `createDonationYearHandler()` ensures a `DonationLedger` exists before a write.
- `totalDonationsHandler()` wraps aggregate reads for the page, including voluntary donations, interest cleansing, and deductible totals.
- `addRow()`, `editRow()`, and `deleteRow()` validate input, enforce auth, mutate, and `revalidatePath('/cashflow/donations')`.

### Validation
- `CreateDonationPaymentSchema`
- `UpdateDonationPaymentSchema`
- `DeleteDonationPaymentSchema`
- Form input requires valid date, positive amount, beneficiary selection, and donation purpose.
- DGR status is not user-entered on the payment; it is derived from the selected beneficiary.

## UI Composition
1. `page.tsx` resolves the selected fiscal year and summary totals.
2. `form.tsx` owns year selection, totals display, and deductible summary.
3. `DonationTableServer.tsx` fetches payment rows server-side.
4. `DonationTableClient.tsx` renders TanStack Table rows with inline editing.
5. `StateProvider.tsx` + `reducer.ts` hold edit-row and loading state.
6. `_table/columns.tsx` must include a visible donation-purpose column and a deductible-status display column.
7. `_components/` contain enrichment and beneficiary helpers such as `UnlinkedTransactionsBanner`, `LinkTransactionsDrawer`, and `CreateBeneficiaryModal`.

### Unified Classification Flow
- The transaction ledger should present a single classification choice for charitable outflows.
- The chooser must route to Donation - Voluntary, Donation - Interest Cleansing, or Zakat.
- Classification into Donation should open the donations enrichment flow with purpose preselected.
- The donation enrichment drawer should default `beneficiaryType` to `Business`; `Individual` is a deliberate exception.
- Linked transactions should be reclassified out of `Other` into purpose-specific reporting labels so expense breakdowns can separate Donation, Interest Cleansing, and Zakat.

## Reporting
- Page totals must show at minimum:
  - Voluntary donations total
  - Interest cleansing total
  - Deductible total
  - Non-deductible total
- Totals should be grouped by fiscal year and reflect linked and manual rows together.
- Year-end tax summary should expose the deductible total for use in ATO reporting.

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
| `src/app/(authorized)/cashflow/donations/_table/columns.tsx` | TanStack column config, including purpose and tax display |
| `src/app/(authorized)/cashflow/donations/_table/DonationTypeSelectionCell.tsx` | Editable purpose cell for donation rows |
| `src/app/(authorized)/cashflow/donations/_components/UnlinkedTransactionsBanner.tsx` | Banner for imported but unlinked donation transactions |
| `src/app/(authorized)/cashflow/donations/_components/LinkTransactionsDrawer.tsx` | Drawer UI for transaction enrichment |
| `src/app/(authorized)/cashflow/donations/_components/CreateBeneficiaryModal.tsx` | Inline beneficiary creation flow |

## Migration Note
This feature now lives under `spec/cashflow/donations/donations/`; this file is the canonical implementation inventory for the cashflow donations subgroup.

## Notes for Future Changes
- `DonationLedger` is the concrete schema name, but the feature should still be discussed as the donations workflow at the product level.
- Transaction linking is intentionally optional so manual donation entry remains valid.
- File inventory stays here to keep `context.md` focused on scope and dependencies.
