# Transaction Ledger — Context

## Problem

After a user completes a CSV import wizard, the confirmed transactions are written to the database but are completely invisible in the UI. The `/cashflow/transactions` page only shows import buttons. There is no way to browse, search, filter, or edit past transactions. Transfer/Excluded entries are orphaned audit records with no surface area in the app.

---

## File Inventory

### Files to CREATE

| File | Role |
|---|---|
| `src/server/api/routers/transaction-ledger.ts` | tRPC router — `getAll` (paginated query), `updateCategory` (mutation) |
| `src/components/transactions/TransactionLedgerTable.tsx` | Main ledger table Client Component — tabs, filters, rows |
| `src/components/transactions/TransactionFilters.tsx` | Filter bar — type tabs, date range, bank account, search |
| `src/components/transactions/TransactionRow.tsx` | Single row with inline category edit |
| `src/server/services/transactions/ledger.service.ts` | DB logic — query builder, category re-rollup on edit |

### Files to MODIFY

| File | Change |
|---|---|
| `src/server/api/root.ts` | Register `transactionLedger` router |
| `src/app/(authorized)/cashflow/transactions/page.tsx` | Fetch initial data server-side, pass to client |
| `src/app/(authorized)/cashflow/transactions/_components/TransactionsClient.tsx` | Add `<TransactionLedgerTable>` below import cards; accept `onImportComplete` callback to refresh |
| `src/app/(authorized)/cashflow/transactions/_components/csv/CSVImportWizard.tsx` | Call `onImportComplete` after successful confirm to trigger ledger refresh |

---

## Schema Details

### `Transaction` model
```prisma
model Transaction {
  id              String                 @id @default(cuid())
  date            DateTime
  description     String
  amount          Decimal                @db.Money
  type            TransactionTypeEnum    // DEBIT | CREDIT
  category        String                 // free-text category name
  source          TransactionSourceEnum  // LLM_CLASSIFIED | USER_OVERRIDE
  status          TransactionStatusEnum  // PENDING | CONFIRMED | EXCLUDED
  confirmedAt     DateTime?
  bankAccountId   String?
  bankAccount     BankAccount?
  userId          String
  user            User
  importSessionId String?
  importSession   ImportSession?
  createdAt       DateTime               @default(now())
  updatedAt       DateTime               @updatedAt

  @@index([userId, bankAccountId, date])
  @@index([userId, type, status])
  @@index([importSessionId])
}
```

### Enums
```prisma
enum TransactionTypeEnum   { DEBIT CREDIT }
enum TransactionStatusEnum { PENDING CONFIRMED EXCLUDED }
enum TransactionSourceEnum { LLM_CLASSIFIED USER_OVERRIDE }

enum IncomeSourceEnumType  {
  EMPLOYMENT STOCKS BONDS RENTAL BUSINESS FREELANCE DIVIDEND OTHER
}
```

### Related models (for re-rollup on category edit)
```
ExpenseLedger  — calendarId + userId composite key
  └─ MonthlyExpenseSummary — ledgerId + categoryId + month → amount (Decimal)

IncomeLedger   — calendarId + userId composite key
  └─ IncomeRecord — incomeLedgerId + dateEarned + amount + source (IncomeSourceEnumType)

ExpenseCategory — id + name (used for categoryId in MonthlyExpenseSummary)
```

**Important gap:** `Transaction` has no direct FK to `IncomeRecord`. Re-linking on credit category edit requires matching by `(userId, date, amount)`.

---

## Existing Patterns to Reuse

### tRPC router pattern
See `src/server/api/routers/` — routers use `protectedProcedure`, Zod input validation, and `ctx.session.user.id` for scoping.

### Table component pattern
`src/components/csv-import/TransactionReviewTable.tsx` — tab expand/collapse, inline `<select>` for category edit, `useCallback` for handlers, dark mode classes.

### Filter/tab pattern
`src/app/(authorized)/cashflow/transactions/_components/csv/CSVTransactionReviewTable.tsx` — tab bar with `activeTab` state, `border-b-2 border-teal-500` active style.

### Toast notifications
`react-toastify` — `toast.success()` / `toast.error()` used throughout for mutations.

### Pagination pattern
TanStack Query `useInfiniteQuery` or simple offset pagination via tRPC with `cursor` + `limit`.

---

## What Exists at `/cashflow/transactions` Today

```
page.tsx (Server Component)
  └─ TransactionsClient (Client Component)
       ├─ ImportCard "CSV Bank Statement" → opens CSVImportWizard
       ├─ ImportCard "AI Receipt / Invoice" → opens AIImportWizard
       ├─ <CSVImportWizard> (Portal, controlled by csvOpen state)
       └─ <AIImportWizard> (Portal, controlled by aiOpen state)
```

No transaction list exists. `page.tsx` only fetches `bankAccounts`.

---

## Data Flow After CSV Confirm (current)

```
CSVImportWizard.handleConfirm
  → POST /api/transactions/csv/confirm
      → confirmDebitTransactions()
          → Transaction(CONFIRMED) + MonthlyExpenseSummary upsert
      → confirmCreditTransactions()
          → income: Transaction(CONFIRMED) + IncomeRecord
          → excluded: Transaction(EXCLUDED) only
  → CSVResultsStep shown ("Done" closes wizard)
  → no refresh of any list (nothing to refresh)
```
