# Zakat - Low Level Design

## Server Contracts

| Action | Service Call |
|---|---|
| Create | `addZakatPaymentDetail()` |
| Update | `updateZakatPayment()` |
| Delete | `deleteZakatPayment()` |
| Read Payments | `getZakatPayments()` |

## UX Flows

### 1) Create Zakat Payment
```mermaid
sequenceDiagram
  participant UI as Frontend
  participant API as addZakatPaymentDetail()
  participant DB as DB (ZakatPayment)

  UI->>API: POST /zakat/payments {payload}
  API->>DB: INSERT into ZakatPayment
  DB-->>API: Success
  API-->>UI: 200 OK
```
