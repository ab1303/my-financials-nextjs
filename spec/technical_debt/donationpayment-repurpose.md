# Repurposing `DonationPayment` — Schema & Domain Architecture

## Decision (PO)

Adopted the **Split into Domain Models** approach: purpose-scoped models for `VoluntaryDonation`, `InterestCleansing`, and `ZakatPayment` to ensure strict domain boundaries and DB-level invariants, while maintaining service responsibilities and API stability for the frontend.

## Key constraints

- The frontend/UX remains unchanged. API shapes are stable.
- `DGR` status is deduced from `BusinessEntity` at request time (no historical snapshot stored on donation records).

## Schema (Actual)

```prisma
enum DonationPurpose { VOLUNTARY INTEREST_CLEANSING ZAKAT }

model VoluntaryDonation {
  id               String              @id @default(cuid())
  datePaid         DateTime
  amount           Decimal             @db.Decimal(19, 4)
  beneficiaryType  BeneficiaryEnumType
  businessId       String?
  individualId     String?
  donationLedgerId String
  purpose          DonationPurposeEnum @default(VOLUNTARY)
  transactionId    String?             @unique
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt
  business         Business?           @relation(fields: [businessId], references: [id])
  donationLedger   DonationLedger      @relation(fields: [donationLedgerId], references: [id])
  individual       Individual?         @relation(fields: [individualId], references: [id])
  transaction      Transaction?        @relation(fields: [transactionId], references: [id])
}

model InterestCleansing {
  id               String                      @id @default(cuid())
  datePaid         DateTime
  amount           Decimal                     @db.Decimal(19, 4)
  sourceBusinessId String?
  donationLedgerId String
  creditTxId       String?                     @unique
  createdAt        DateTime                    @default(now())
  updatedAt        DateTime                    @updatedAt
  creditTx         Transaction?                @relation("InterestCredit", fields: [creditTxId], references: [id])
  donationLedger   DonationLedger              @relation(fields: [donationLedgerId], references: [id])
  sourceBusiness   Business?                   @relation(fields: [sourceBusinessId], references: [id])
  evidence         InterestCleansingEvidence[]
}

model InterestCleansingEvidence {
  id                  String            @id @default(cuid())
  interestCleansingId String
  transactionId       String
  amountApplied       Decimal?          @db.Decimal(12, 2)
  confidence          Float?            @default(0)
  createdAt           DateTime          @default(now())
  updatedAt           DateTime          @updatedAt
  interestCleansing   InterestCleansing @relation(fields: [interestCleansingId], references: [id], onDelete: Cascade)
  transaction         Transaction       @relation(fields: [transactionId], references: [id], onDelete: Cascade)

  @@unique([interestCleansingId, transactionId])
}

model ZakatPayment {
  id                String              @id @default(cuid())
  datePaid          DateTime
  amount            Decimal             @db.Decimal(19, 4)
  beneficiaryType   BeneficiaryEnumType
  businessId        String?
  individualId      String?
  zakatObligationId String
  transactionId     String?             @unique
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  business          Business?           @relation(fields: [businessId], references: [id])
  individual        Individual?         @relation(fields: [individualId], references: [id])
  transaction       Transaction?        @relation(fields: [transactionId], references: [id])
  zakatObligation   ZakatObligation     @relation(fields: [zakatObligationId], references: [id])
}
```

## UX Flows

### 1) Create Donation

```mermaid
sequenceDiagram
  participant UI as Frontend
  participant API as Donation Service (API)
  participant DB as DB (Voluntary|Zakat|Interest)

  UI->>API: POST /donations {payload}
  API->>API: determine purpose
  API->>DB: INSERT into Voluntary|Zakat|Interest table
  DB-->>API: 201 created
  API-->>UI: 201 OK (DonationPaymentModel shape)
```

### 2) Reconciliation (Link Transaction)

```mermaid
sequenceDiagram
  participant UI
  participant API
  participant DB

  UI->>API: POST /reconciliations/link {donationId, transactionId}
  API->>DB: INSERT into *Evidence table
  DB-->>API: 200 OK
  API-->>UI: 200 OK
```

### 3) Ledger Display

```mermaid
sequenceDiagram
  participant UI
  participant API
  participant DB

  UI->>API: GET /ledger?filters
  API->>DB: SELECT from Voluntary|Interest|Zakat tables
  API->>API: map to DonationPaymentModel[]
  API-->>UI: DonationPaymentModel[]
```

### 4) Tax Claim (derive DGR)

```mermaid
sequenceDiagram
  participant UI
  participant API
  participant Tax as TaxService
  participant BE as BusinessEntity
  participant DB

  UI->>API: GET /donation/:id/tax-claim
  API->>DB: SELECT recipientBusinessEntityId, donationDate
  API->>Tax: request claimability(recipientBusinessEntityId, donationDate)
  Tax->>BE: lookup DGR status
  BE-->>Tax: DGR true/false
  Tax-->>API: claimability result
  API-->>UI: claimability response
```
