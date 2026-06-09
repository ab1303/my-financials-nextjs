# DonationPayment Full Redesign — LLD (Prisma + API Mapping)

Purpose: implement a clear domain model by splitting the overloaded `DonationPayment` into purpose-scoped models while preserving the existing API shapes used by the frontend.

Principles:

- Keep `Transaction` (ledger) as the source of truth for transactions.
- Preserve API DTO keys so the UI remains unchanged (`id`, `datePaid`, `amount`, `beneficiaryType`, `beneficiaryId`, `isDeductible`, `donationPurpose`, `transactionId`).
- Capture minimal changes to server controllers — map new domain rows to existing DTOs.

Prisma models (LLD)

```prisma
enum DonationPurposeEnum { VOLUNTARY INTEREST_CLEANSING ZAKAT }

model VoluntaryDonation {
  id             String   @id @default(cuid())
  datePaid       DateTime
  amount         Decimal  @db.Money
  beneficiaryType BeneficiaryEnumType
  business       Business? @relation(fields: [businessId], references: [id])
  businessId     String?
  individual     Individual? @relation(fields: [individualId], references: [id])
  individualId   String?
  donationLedger DonationLedger @relation(fields: [donationLedgerId], references: [id])
  donationLedgerId String
  purpose        DonationPurposeEnum @default(VOLUNTARY)
  transactionId  String?
  transaction    Transaction? @relation(fields: [transactionId], references: [id])
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model InterestCleansing {
  id               String   @id @default(cuid())
  datePaid         DateTime
  amount           Decimal  @db.Money
  businessId       String? // philanthropic business
  business         Business? @relation(fields: [businessId], references: [id])
  donationLedger   DonationLedger @relation(fields: [donationLedgerId], references: [id])
  donationLedgerId String
  creditTx         Transaction? @relation("InterestCredit", fields: [creditTxId], references: [id], onDelete: SetNull)
  creditTxId       String? @unique
  evidence         InterestCleansingEvidence[]
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}

model InterestCleansingEvidence {
  id                    String @id @default(cuid())
  interestCleansingId   String
  interestCleansing     InterestCleansing @relation(fields: [interestCleansingId], references: [id], onDelete: Cascade)
  transactionId         String
  transaction           Transaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  amountLinked          Decimal? @db.Money
  confidence            Float? @default(0)
  createdAt             DateTime @default(now())
  @@unique([interestCleansingId, transactionId])
  @@index([interestCleansingId])
  @@index([transactionId])
}

model ZakatPayment {
  id              String @id @default(cuid())
  datePaid        DateTime
  amount          Decimal  @db.Money
  beneficiaryType BeneficiaryEnumType
  business        Business? @relation(fields: [businessId], references: [id])
  businessId      String?
  individual      Individual? @relation(fields: [individualId], references: [id])
  individualId    String?
  zakatObligation ZakatObligation @relation(fields: [zakatObligationId], references: [id])
  zakatObligationId String
  transactionId   String?
  transaction     Transaction? @relation(fields: [transactionId], references: [id])
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

Mapping to API DTOs (preserve response shape)

- Existing frontend expects donation list items with fields: `id, datePaid, amount, beneficiaryType, beneficiaryId, donationLedgerId, transactionId, isDeductible, donationPurpose`.
- Implement server DTO mappers:
  - For `VoluntaryDonation` and `ZakatPayment`: return `transactionId` as `null` or the relevant evidence/linked transaction when a single primary transaction is required by UX. Prefer to return `transactionId` as the first evidence transaction id if one exists to maintain behaviour.
  - For `InterestCleansing`: map `creditTxId` -> `transactionId` in the DTO to preserve current client expectation for interest-credit-linked donations.

Server-side rules

- Writes (create/update/delete) must maintain evidence uniqueness and clear `creditTxId` when evidence is removed and no allocations remain.
- `isDeductible` continues to be computed from `Business.isDgrRegistered` (no snapshot taken).

Notes on `BusinessEntity` DGR

- Per decision, DGR is derived from the `Business` table at request time. If historical determinism becomes necessary later, add `BusinessDgrHistory` with `effectiveFrom`/`effectiveTo`.
