# Repurposing `DonationPayment` — Schema & Domain Architecture

## Decision (PO)

Adopted the **Split into Domain Models** approach: purpose-scoped models for `VoluntaryDonation`, `InterestCleansing`, and `ZakatPayment` to ensure strict domain boundaries and DB-level invariants, while maintaining service responsibilities and API stability for the frontend.

## Key constraints

- The frontend/UX remains unchanged. API shapes are stable.
- `DGR` status is deduced from `BusinessEntity` at request time (no historical snapshot stored on donation records).

## Schema (Actual)

```prisma

Look at @schema.prisma for

enum DonationPurpose { VOLUNTARY INTEREST_CLEANSING ZAKAT }

model VoluntaryDonation {...}

model InterestCleansing { ... }

model InterestCleansingEvidence { ... }

model ZakatPayment { ... }
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
