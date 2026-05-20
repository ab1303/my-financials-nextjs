# Zakat — Low Level Design

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
}
```

## Server Contracts

### Service Layer
- `addZakatCalendarYearDetails()` — creates the yearly obligation record.
- `getZakat()` — returns the `amountDue` header for a selected year.
- `getZakatPayments()` — fetches payment rows plus beneficiary relations.
- `addZakatPaymentDetail()` / `updateZakatPayment()` / `deleteZakatPayment()` — payment CRUD.

### Validation and Actions
- `CreateZakatPaymentSchema`
- `UpdateZakatPaymentSchema`
- `DeleteZakatPaymentSchema`
- `addRow()`, `editRow()`, and `deleteRow()` enforce auth, validate payloads, and mutate the selected obligation's payments.

## UI Composition

1. `page.tsx` loads Zakat years and selected obligation data.
2. `form.tsx` handles year selection and `amountDue` display/editing.
3. `ZakatTableServer.tsx` fetches payment rows for the selected year.
4. `ZakatTableClient.tsx` renders the interactive payment table.
5. `StateProvider.tsx` + `reducer.ts` manage client-side payment state.
6. `_table/columns.tsx` and `BeneficiarySelectionCell.tsx` implement inline editing.

## File Inventory

| File | Role |
|---|---|
| `prisma/schema.prisma` | `ZakatObligation` and `ZakatPayment` schema |
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
