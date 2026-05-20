# Transactions Domain — High Level Design

## Problem Statement

The app's transaction pipeline is an import-only system with no post-import visibility or correction surface. Transactions enter via CSV or AI import and are immediately invisible. Duplicate data accumulates when date ranges overlap. Inter-account transfers inflate expense reports. Income records cannot be deterministically linked to their source transactions. There is no reversal mechanism for incorrect imports. The goal is to evolve the transactions domain into a universal import hub with full post-import lifecycle management: browse, correct, deduplicate, reconcile, reverse, and enrich — with zero data loss.

---

## Shared Data Models

### `Transaction`

```prisma
model Transaction {
  id              String                 @id @default(cuid())
  date            DateTime
  description     String
  amount          Decimal                @db.Money
  type            TransactionTypeEnum    // DEBIT | CREDIT
  category        String                 // free-text category name
  source          TransactionSourceEnum  // LLM_CLASSIFIED | USER_OVERRIDE
  status          TransactionStatusEnum  // PENDING | CONFIRMED | EXCLUDED | VOIDED
  confirmedAt     DateTime?
  bankAccountId   String?
  bankAccount     BankAccount?
  userId          String
  user            User
  importSessionId String?
  importSession   ImportSession?

  // Transfer reconciliation
  transferLinkedTransactionId  String?                @unique
  transferLinkedTransaction    Transaction?           @relation("TransferLink", fields: [transferLinkedTransactionId], references: [id])
  transferCounterpart          Transaction?           @relation("TransferLink")
  preLinkCategory              String?
  preLinkStatus                TransactionStatusEnum?

  // Enrichment back-references
  donationPayment  DonationPayment?
  zakatPayment     ZakatPayment?
  incomeRecord     IncomeRecord?

  createdAt       DateTime               @default(now())
  updatedAt       DateTime               @updatedAt

  @@index([userId, bankAccountId, date])
  @@index([userId, type, status])
  @@index([importSessionId])
}

enum TransactionTypeEnum   { DEBIT CREDIT }
enum TransactionStatusEnum { PENDING CONFIRMED EXCLUDED VOIDED }
enum TransactionSourceEnum { LLM_CLASSIFIED USER_OVERRIDE }
```

### `TransferMatchCandidate` (TypeScript only — not persisted)

```typescript
interface TransferMatchCandidate {
  transactionId: string;
  bankAccountId: string;
  bankAccountName: string;
  bankName: string | null;
  date: string;
  description: string;
  amount: number;
  type: TransactionTypeEnum;
  status: TransactionStatusEnum;
  confidenceScore: number; // 0–100
  scoreBreakdown: {
    amountMatch: number;           // 0–40
    dateProximity: number;         // 0–30
    descriptionSimilarity: number; // 0–20
    sameBankBonus: number;         // 0–10
  };
  amountDiffWarning: string | null;
}
```

### `TransferMatchRule` (persisted — Phase 2 of transfer-match-rules)

```prisma
model TransferMatchRule {
  id                  String    @id @default(cuid())
  userId              String
  name                String
  amountExact         Decimal?
  debitKeywords       String[]
  creditKeywords      String[]
  maxDayGap           Int       @default(5)
  debitBankAccountId  String?
  creditBankAccountId String?
  confidenceThreshold Int       @default(85)
  isActive            Boolean   @default(true)
  createdAt           DateTime  @default(now())
}
```

---

## Architecture Decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | **Transaction = immutable cash record** | Date and amount are canonical; enrichment records add purpose | Prevents amount drift across donation, Zakat, and income attribution layers |
| 2 | **VOIDED is a terminal status** | Voided transactions excluded from all financial aggregates; not hard-deleted | Audit trail preservation; VOIDED rows remain visible in a dedicated tab |
| 3 | **Transfer uses EXCLUDED status, not a new enum** | `category='Transfer'` discriminates; `status=EXCLUDED` suppresses rollup | Avoids migrating existing EXCLUDED rows; all status-based queries unchanged |
| 4 | **Dedup is auto-skip, not user-review** | Matches Copilot Money pattern; O(n) batch pre-fetch via Set lookup | Zero friction for the common case; deterministic bank CSVs make review unnecessary |
| 5 | **IncomeRecord.transactionId FK** | Nullable FK with `onDelete: SetNull` | Makes CREDIT reversal deterministic; same pattern as DonationPayment |
| 6 | **Transfer matching is manual + assisted** | User confirms all links; auto-suggestions score candidates | Financial accuracy is paramount — no auto-link without confirmation in MVP |
| 7 | **Reversal is always atomic** | All undo/void operations run inside `prisma.$transaction` | Partial reversal creates worse data corruption than the original problem |
| 8 | **Enrichment is a separate domain concern** | Transaction Ledger is the visibility surface; enrichment pages manage their own attribution | Cross-attribution badges (isDonationLinked, isZakatLinked) are display-only in the ledger |
| 9 | **Fiscal year lock is user-initiated** | `CalendarYear.lockedAt` set manually; hard-blocks undo for locked years | Tax filings are year-based; time-based cutoffs are arbitrary |

---

## Out of Scope

| Item | Reason |
|---|---|
| Manual transaction entry (no import) | Phase 2+ feature |
| Hard-deleting Transaction records (except voided purge) | Audit trail must be preserved |
| Automatic fiscal year locking | Tax deadlines vary by user/region |
| AI-assisted fuzzy dedup matching | Phase 2+; bank CSVs are deterministic |
| Real-time bank API sync (Basiq) | Separate integration |
| Foreign currency / FX rate transfers | FX handling not modelled |
| Credit card payment reconciliation | Credit cards not modelled as BankAccount |
