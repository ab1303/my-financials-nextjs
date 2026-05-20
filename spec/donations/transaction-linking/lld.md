# Transaction Linking — Low Level Design

## Phase Map

| Phase | Description |
|---|---|
| 1 | Add nullable `transactionId` FK to `DonationPayment` |
| 2 | Query unlinked donation transactions for a fiscal-year date range |
| 3 | Surface the server-rendered banner on the Donations page |
| 4 | Provide drawer UI and action/schema updates for linking |
| 5 | Show donation-link badges in the transaction ledger |

## Schema Contract

```prisma
model DonationPayment {
  id               String              @id @default(cuid())
  datePaid         DateTime
  amount           Decimal             @db.Money
  beneficiaryType  BeneficiaryEnumType
  taxCategory      String
  donationLedgerId String
  transaction      Transaction?        @relation(fields: [transactionId], references: [id], onDelete: SetNull)
  transactionId    String?             @unique
}
```

**Rules:**
- `transactionId` is nullable so manual entries still work.
- `transactionId` is unique so one imported transaction maps to at most one donation row.
- Date and amount come from the source transaction during the enrichment flow.

## Data Flow

1. User selects a fiscal year on `/cashflow/donations`.
2. Server counts `DEBIT` + `CONFIRMED` transactions categorized as `Gifts & donations` within that fiscal-year range.
3. Banner appears when at least one transaction is still unlinked.
4. Drawer fetches the candidate transactions and lets the user complete beneficiary and tax metadata.
5. Save calls the existing donation create path with an added `transactionId`.
6. The linked transaction disappears from the banner count and can display a linked badge in the ledger.

## File Inventory

| File | Role |
|---|---|
| `prisma/schema.prisma` | Adds `DonationPayment.transactionId` relation |
| `src/server/services/transactions/donation-link.service.ts` | Queries/counts unlinked donation transactions |
| `src/server/trpc/router/transaction-ledger.ts` | Exposes `getUnlinkedDonationTransactions` and ledger badge state |
| `src/app/(authorized)/cashflow/donations/_components/UnlinkedTransactionsBanner.tsx` | Server banner for unlinked imported donations |
| `src/app/(authorized)/cashflow/donations/_components/LinkTransactionsDrawer.tsx` | Client drawer for enrichment and save-next flow |
| `src/app/(authorized)/cashflow/donations/_components/LinkTransactionsDrawerTrigger.tsx` | Client wrapper that opens the drawer from a server-rendered banner |
| `src/app/(authorized)/cashflow/donations/page.tsx` | Wires the banner into the donations page |
| `src/app/(authorized)/cashflow/donations/actions.ts` | Accepts optional `transactionId` during create |
| `src/app/(authorized)/cashflow/donations/_schema.ts` | Adds optional `transactionId` to the create schema |
| `src/app/(authorized)/cashflow/donations/_types.ts` | Extends `DonationPaymentType` with `transactionId` |
| `src/components/transactions/TransactionRow.tsx` | Displays linked/unlinked donation badge in ledger UI |

## Migration Note
This feature consolidates the deleted flat transaction-linking spec into the donations domain structure; this file now holds the canonical implementation contract.

## Acceptance-Oriented Checks
- Unlinked imported donations are counted only within the active fiscal year.
- Saving a linked donation pre-fills immutable date and amount from the source transaction.
- A linked transaction cannot be linked again because of the unique FK.
- Manual donation entry continues to work when `transactionId` is absent.
