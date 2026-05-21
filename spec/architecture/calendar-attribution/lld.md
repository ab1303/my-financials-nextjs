# Calendar Attribution — Low-Level Design

## Architectural Decision

**Transaction-as-source-of-truth is the correct architecture.** A single bank transaction can—and *should*—be attributed to multiple independent calendar year types simultaneously.

This is not double-counting; it is correct multi-dimensional accounting where each calendar year type represents a different legal/religious obligation with its own reporting ledger.

## Key Insight

A $500 donation on 2024-11-15 is simultaneously:

| Context | Calendar Year | Record | Purpose |
|---------|--------------|--------|---------|
| Tax deduction | FY2025 (FISCAL: Jul 1 2024 – Jun 30 2025) | `DonationPayment` → `DonationLedger` → `CalendarYear(FISCAL)` | ATO claim |
| Zakat fulfilment | 1446H (ZAKAT: Jul 7 2024 – Jun 26 2025) | `ZakatPayment` → `ZakatObligation` → `CalendarYear(ZAKAT)` | Islamic obligation |

These are **independent ledgers for independent legal/religious obligations**. The Australian Tax Office and Islamic Zakat have no bearing on each other. They overlap in time but serve completely different purposes.

## Schema Design Pattern

The Prisma schema already supports this correctly:

```prisma
model Transaction {
  id String @id @default(cuid())
  amount Decimal
  date DateTime
  
  // Each junction table has its own 1:1 link to Transaction
  donationPayment DonationPayment?  // @unique on transactionId
  zakatPayment    ZakatPayment?     // @unique on transactionId
}

model DonationPayment {
  id String @id @default(cuid())
  transactionId String @unique  // Prevents 2+ donation records per transaction
  donationLedgerId String
  donationLedger DonationLedger @relation(fields: [donationLedgerId], references: [id])
  transaction Transaction @relation(fields: [transactionId], references: [id])
}

model ZakatPayment {
  id String @id @default(cuid())
  transactionId String @unique  // Prevents 2+ zakat records per transaction
  zakatObligationId String
  zakatObligation ZakatObligation @relation(fields: [zakatObligationId], references: [id])
  transaction Transaction @relation(fields: [transactionId], references: [id])
}
```

**Key constraint**: `@unique` on `DonationPayment.transactionId` prevents a transaction from being linked to *two donation records*. Similarly, `@unique` on `ZakatPayment.transactionId` prevents a transaction from being linked to *two zakat records*. However, **cross-purpose linking is unrestricted and correct**—a single transaction can be both a `DonationPayment` AND a `ZakatPayment`.

## Date Boundary Handling

When a transaction straddles calendar year boundaries (e.g., 2024-06-30 is the last day of FY2024 and the first day of FY2025), the application should:

1. Determine which calendar year the transaction date falls into for each calendar type
2. Record the transaction in the appropriate ledger(s)
3. Handle partial attribution if needed (user can count only $400 of a $500 donation toward Zakat, for example)

## Implementation Files

| File | Type | Purpose |
|------|------|---------|
| `src/server/services/calendar.service.ts` | Service | Calendar year lookup and attribution logic |
| `src/server/services/donation.service.ts` | Service | Donation payment creation with calendar attribution |
| `src/server/services/zakat.service.ts` | Service | Zakat payment creation with calendar attribution |
| `prisma/schema.prisma` | Schema | FK and @unique constraints as described above |
| `src/types/calendar.types.ts` | Types | Calendar attribution type definitions |

## Validation Checklist

- [ ] Schema supports 1:1 relationship between Transaction and DonationPayment
- [ ] Schema supports 1:1 relationship between Transaction and ZakatPayment
- [ ] A single transaction can be both a donation and zakat payment (confirmed via Prisma constraints)
- [ ] Date boundary logic correctly assigns transactions to calendar years
- [ ] Partial attribution (amount differs between ledgers) is supported
- [ ] No duplicate records created when a transaction is attributed multiple times
