# Transaction

## Purpose
Stores staged transaction lines imported from CSV or AI extraction, supporting review, confirmation, exclusions, transfers, reimbursements, and downstream linkage to income or philanthropic records.

## Domain
Transactions

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| date | DateTime | No | Transaction date. |
| description | String | No | Transaction description text. |
| amount | Decimal (`Money`) | No | Transaction amount. |
| type | TransactionTypeEnum | No | Direction, such as `DEBIT` or `CREDIT`. |
| category | String | No | Assigned category name. |
| offsetCategory | String | Yes | Offset category for reimbursements. |
| offsetTransactionId | String | Yes | Optional self-reference to offset/reimbursement pair. |
| source | TransactionSourceEnum | No | Classification source such as `LLM_CLASSIFIED` or `USER_OVERRIDE`. |
| status | TransactionStatusEnum | No | Workflow status such as `PENDING`, `CONFIRMED`, `EXCLUDED`, or `VOIDED`. |
| confirmedAt | DateTime | Yes | Timestamp when the transaction was confirmed. |
| bankAccountId | String | Yes | Optional foreign key to the financial account. |
| userId | String | No | Owner user foreign key. |
| importSessionId | String | Yes | Optional foreign key to the source import session. |
| transferLinkedTransactionId | String | Yes | Optional one-to-one self-reference for matched transfer pairs. |
| preLinkCategory | String | Yes | Category value before transfer-linking. |
| preLinkStatus | TransactionStatusEnum | Yes | Status before transfer-linking. |
| preVoidStatus | TransactionStatusEnum | Yes | Status before voiding. |
| createdAt | DateTime | No | Record creation timestamp. |
| updatedAt | DateTime | No | Auto-updated modification timestamp. |

## Relationships
### Belongs To
- FinancialAccount (`bankAccountId` → `FinancialAccount.id`, optional)
- User (`userId` → `User.id`)
- ImportSession (`importSessionId` → `ImportSession.id`, optional)
- Transaction (`offsetTransactionId` self-reference, optional)
- Transaction (`transferLinkedTransactionId` self-reference, optional)

### Has Many
- IncomeRecord (optional one-to-one from `IncomeRecord.transactionId`)
- DonationPayment (optional one-to-one from `DonationPayment.transactionId`)
- ZakatPayment (optional one-to-one from `ZakatPayment.transactionId`)

## Indexes & Constraints
- Primary key on `id`
- Unique constraint on `transferLinkedTransactionId`
- Index on `[userId, bankAccountId, date]`
- Index on `[userId, type, status]`
- Index on `[importSessionId]`
- Foreign keys to `FinancialAccount`, `User`, and `ImportSession`

## Notes
This is the core staging table for imported financial activity. Schema comments indicate self-relations for reimbursement links and transfer links.