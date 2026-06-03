# Zakat - Low Level Design

## Concrete Data Model

### `ZakatObligation`
```prisma
model ZakatObligation {
  id         String         @id @default(cuid())
  calendarId String         @unique
  amountDue  Decimal        @db.Money
  payments   ZakatPayment[]
}
```

### `ZakatPayment`
```prisma
model ZakatPayment {
  id                String              @id @default(cuid())
  datePaid          DateTime
  amount            Decimal             @db.Money
  beneficiaryType   BeneficiaryEnumType
  businessId        String?
  individualId      String?
  zakatObligationId String
  transactionId     String?             @unique
}
```

### Key Rules
- DGR status is derived from the selected beneficiary's `Business` record, not duplicated on the payment row.
- Zakat purpose does not itself determine deductibility.
- A Zakat payment linked to a DGR beneficiary is deductible; otherwise it is non-deductible.
- `transactionId` is optional so imported bank evidence can be reconciled without requiring a manual entry path first.

## Server Contracts

### Service Layer
- `addZakatCalendarYearDetails()` - creates the yearly obligation record.
- `getZakat()` - returns the `amountDue` header for a selected year.
- `getZakatPayments()` - fetches payment rows plus beneficiary relations.
- `getZakatTotals()` - returns Zakat totals plus deductible and non-deductible breakdowns.
- `addZakatPaymentDetail()` / `updateZakatPayment()` / `deleteZakatPayment()` - payment CRUD.

### Validation and Actions
- `CreateZakatPaymentSchema`
- `UpdateZakatPaymentSchema`
- `DeleteZakatPaymentSchema`
- `addRow()`, `editRow()`, and `deleteRow()` enforce auth, validate payloads, and mutate the selected obligation's payments.
- Tax category is not user-entered; it is derived from beneficiary selection.
- DGR status is not user-entered on the payment; it is derived from the selected beneficiary.

## UI Composition
1. `page.tsx` loads Zakat years and selected obligation data.
2. `form.tsx` handles year selection and `amountDue` display/editing.
3. `ZakatTableServer.tsx` fetches payment rows for the selected year.
4. `ZakatTableClient.tsx` renders the interactive payment table.
5. `StateProvider.tsx` + `reducer.ts` manage client-side payment state.
6. `_table/columns.tsx` and `BeneficiarySelectionCell.tsx` implement inline editing.
7. A deductible-status display column should show the derived result for each payment row.

### Unified Classification Flow
- The ledger classification chooser must support a direct Zakat path.
- When a user chooses Zakat, the flow should open the Zakat enrichment experience with beneficiary and tax derivation visible.
- The Zakat enrichment drawer should default `beneficiaryType` to `Business`; `Individual` is an explicit exception.
- Zakat and donations should share the same transaction-linking expectations so imported bank entries can be reconciled consistently.
- Linked transactions should be reclassified out of `Other` into purpose-specific reporting labels so expense breakdowns can separate Donation, Interest Cleansing, and Zakat.

## Reporting
- Zakat totals must feed into the same year-end deductible summary as donations.
- Reporting should distinguish deductible and non-deductible rows inside the Zakat view.
- The obligation header should remain the source of truth for `amountDue`.

## File Inventory
| File | Role |
|---|---|
| `prisma/schema.prisma` | `ZakatObligation`, `ZakatPayment`, optional `transactionId` relation |
| `src/server/services/zakat.service.ts` | Obligation reads and payment CRUD |
| `src/server/models/zakat.ts` | `ZakatModel`, `ZakatPaymentModel`, service input types |
| `src/server/controllers/zakat.controller.ts` | Year-level Zakat handlers |
| `src/app/(authorized)/zakat/actions.ts` | Authenticated server actions for payment CRUD |
| `src/app/(authorized)/zakat/page.tsx` | Server page composition |
| `src/app/(authorized)/zakat/form.tsx` | Year filter and amount-due UI |
| `src/app/(authorized)/zakat/ZakatTableServer.tsx` | Server-side payment fetch |
| `src/app/(authorized)/zakat/ZakatTableClient.tsx` | Interactive payment table |
| `src/app/(authorized)/zakat/StateProvider.tsx` | Context provider for payment state |
| `src/app/(authorized)/zakat/reducer.ts` | Reducer for add/edit/remove actions |
| `src/app/(authorized)/zakat/_schema.ts` | Zod schemas for form and payment operations |
| `src/app/(authorized)/zakat/_types.ts` | `ZakatType`, `ZakatPaymentType`, server action types |
| `src/app/(authorized)/zakat/_table/columns.tsx` | TanStack column config |
| `src/app/(authorized)/zakat/_table/BeneficiarySelectionCell.tsx` | Beneficiary selection cell |

## Migration Note
This feature now lives under `spec/cashflow/donations/zakat/`; this file is the canonical implementation inventory for the cashflow donations subgroup.

## Acceptance-Oriented Checks
- Users can manage payment rows only for the selected Zakat year.
- `amountDue` remains attached to the year-scoped obligation header, not duplicated on each payment row.
- Payment mutations validate date, positive amount, beneficiary type, and session state.
- Beneficiary selection remains compatible with both `BUSINESS` and `INDIVIDUAL` paths in the current service layer.
- Zakat payment rows expose derived deductible status and contribute to year-end deductible reporting.
- The beneficiary type dropdown defaults to `Business`.
