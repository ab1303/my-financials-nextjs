# Donations - Low Level Design

## Domain Architecture
The persistence layer is split into purpose-specific models. The service layer (`donation.service.ts`) handles mapping these to a unified `DonationPaymentModel` DTO for the frontend.

### Persistence Models
- `VoluntaryDonation`
- `InterestCleansing`
- `ZakatPayment`

## Server Contracts & Service Calls

| Action | Service Call |
|---|---|
| Create | `addDonationPaymentDetail()` |
| Update | `updateDonationPayment()` |
| Delete | `deleteDonationPayment()` |
| Read Payments | `getDonationPayments()` |
| Get Totals | `getDonationTotalsByCategory()` |

## UX Flows

### 1) Create Donation
```mermaid
sequenceDiagram
  participant UI as Frontend
  participant API as addDonationPaymentDetail()
  participant DB as DB (Voluntary|Zakat|Interest)

  UI->>API: POST /donations {payload}
  API->>DB: INSERT into specific purpose table
  DB-->>API: 201 created
  API-->>UI: 201 OK (DonationPaymentModel shape)
```

### 2) Ledger Display
```mermaid
sequenceDiagram
  participant UI
  participant API as getDonationPayments()
  participant DB as DB (Voluntary|Zakat|Interest)

  UI->>API: GET /ledger?filters
  API->>DB: SELECT from purpose tables
  API->>API: map to DonationPaymentModel[]
  API-->>UI: DonationPaymentModel[]
```
