# Schema Naming Review — My Financials Next.js

**Location:** `spec\schema-naming-review\schema-naming-review.md`
**Date:** 2026-05-13
**Status:** Draft — pending decisions on Open Questions
**Scope:** All 27 models in `prisma\schema.prisma` (T3 Stack: Prisma + PostgreSQL + tRPC + NextAuth)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Naming Principles](#2-naming-principles)
3. [Table-by-Table Analysis](#3-table-by-table-analysis)
   - 3.1 [NextAuth / Infrastructure](#31-nextauth--infrastructure)
   - 3.2 [People & Relationships](#32-people--relationships)
   - 3.3 [Bank Interest & Payments](#33-bank-interest--payments)
   - 3.4 [Zakat](#34-zakat)
   - 3.5 [Donations](#35-donations)
   - 3.6 [Income](#36-income)
   - 3.7 [Expenses](#37-expenses)
   - 3.8 [Calendar](#38-calendar)
   - 3.9 [Bank Assets (Cash)](#39-bank-assets-cash)
   - 3.10 [Stock Assets](#310-stock-assets)
   - 3.11 [AI / Import Infrastructure](#311-ai--import-infrastructure)
   - 3.12 [RAG / Category Mapping](#312-rag--category-mapping)
4. [New Table Proposal — BankTransaction](#4-new-table-proposal--banktransaction)
5. [Summary Rename Map](#5-summary-rename-map)
6. [Migration Impact Summary](#6-migration-impact-summary)
7. [Open Questions](#7-open-questions)

---

## 1. Executive Summary

### Why naming matters here

This codebase spans **five distinct financial domains** (bank assets, expenses, income, donations, zakat) plus AI-assisted import infrastructure — all sharing a single Prisma schema. As the schema grows, ambiguous table names create three concrete problems:

1. **Developer confusion at a glance.** `Expense` is not an expense — it is an empty container. `ExpenseEntry` is not a single expense transaction — it is a monthly budget summary line. A new contributor reading the schema would write wrong queries.

2. **Misleading AI-generated code.** LLM-assisted development (Copilot, Claude) will hallucinate the wrong semantics when model names do not match their domain role. A model called `Expense` will be treated as a transaction record, not a header.

3. **Spec/schema drift.** `TransactionCategoryOverride` reads like a log of overrides, but it is a one-row-per-merchant dictionary. The `@@unique([userId, description])` constraint is invisible from the name alone.

### Principles applied

See [Section 2](#2-naming-principles) for the full set. The headline rule is: **a table's name must describe the domain concept it stores, not its technical role in a parent–child hierarchy.**

---

## 2. Naming Principles

These rules govern all proposals in this document. They take precedence over familiarity with the current names.

| # | Principle | Rationale |
|---|-----------|-----------|
| P1 | **Name the concept, not the role.** Tables should be named after the financial/domain concept they represent, not their structural position (e.g., "header", "child", "entry"). | `Expense` stores no expense data — it stores a *fiscal-year container*. The name should reflect that. |
| P2 | **Header/container tables → `…Ledger` or `…Record`.** Tables that are one-per-period shells (no amount, no event) should use a suffix that signals their aggregation role. | `Expense` → `ExpenseLedger`; `Income` → `IncomeLedger`; `Donation` → `DonationLedger`. |
| P3 | **Lookup/dictionary tables → `…Type`, `…Catalog`, or `…Map`.** Tables that hold a finite set of user-defined reference values should signal that they are looked up, not journaled. | `Relationship` → `RelationshipType`; `TransactionCategoryOverride` → `MerchantCategoryMap`. |
| P4 | **Event/transaction tables → named for the event.** Tables that record something that happened (dated, with amount) should read as a verb-noun: `ZakatPayment`, `DonationPayment`, `IncomeEntry`. | Preserve `ZakatPayment`, `DonationPayment`; rename `ExpenseEntry` → `MonthlyExpenseSummary`. |
| P5 | **Avoid overloading `Entry`.** The word "Entry" currently appears on `ExpenseEntry`, `IncomeEntry`, and `BankAssetEntry` — three tables with fundamentally different semantics (aggregated summary vs. dated event vs. point-in-time balance). Use domain-specific suffixes. | Disambiguates all three in one pass. |
| P6 | **Snapshot headers → `…Snapshot` (already good).** Tables that are a point-in-time header for a set of readings are well-named with `…Snapshot`. Keep this pattern. | `BankAssetSnapshot`, `StockSnapshot` are already clear. |
| P7 | **Import infrastructure → scope-accurate prefixes.** If a table is used for both AI-image and CSV imports, the name must not imply AI-only. | `AIImportSession` → `ImportSession`. |
| P8 | **Consistency across parallel structures.** If Expense and Income share the same header/line pattern, their names should be parallel. | Both renamed together in Section 3. |
| P9 | **NextAuth tables are frozen.** `Account`, `Session`, `VerificationToken`, `User` are owned by the NextAuth Prisma adapter. Do not rename them. | Breaking change with no benefit. |

---

## 3. Table-by-Table Analysis

### 3.1 NextAuth / Infrastructure

| Current Name | What It Actually Stores | Proposed Name | Rationale |
|---|---|---|---|
| `Example` | Scaffolding stub — `id`, `createdAt`, `updatedAt`. No business logic. | **Drop** (or keep as `HealthCheck`) | Leftover T3 scaffold. Has no relations and no production purpose. If kept for DB connectivity tests, rename to `HealthCheck` to make that intent explicit. |
| `Account` | OAuth provider link for a `User` (NextAuth adapter model). | **`Account`** — no change | Frozen by NextAuth Prisma adapter spec. Renaming breaks the adapter. |
| `Session` | Active auth session token (NextAuth adapter model). | **`Session`** — no change | Frozen by NextAuth Prisma adapter spec. |
| `VerificationToken` | Email verification token (NextAuth adapter model). | **`VerificationToken`** — no change | Frozen by NextAuth Prisma adapter spec. |
| `User` | Application user — id, name, email, password, role, all relations. | **`User`** — no change | Standard NextAuth + domain model. Clear and universal. |

---

### 3.2 People & Relationships

| Current Name | What It Actually Stores | Proposed Name | Rationale |
|---|---|---|---|
| `Relationship` | A **user-scoped lookup table of relationship type labels** — e.g., "Mother", "Spouse", "Friend". Not a record of a relationship between two people. | **`RelationshipType`** | The current name reads as an entity-relationship record (ERD sense). Adding `Type` makes the lookup nature explicit. Matches the `@@unique([name, userId])` constraint — one row = one label definition. Parallels `ExpenseCategory` naming pattern already in the schema. |
| `Individual` | A named person the user tracks for zakat/donation disbursements, with optional address. | **`Individual`** — no change | Clear. The domain concept is exactly "an individual person beneficiary". |
| `Business` | An organisation — bank, charity, or brokerage — that the user transacts with. Holds type enum `BANK \| PHILANTHROPY \| BROKERAGE`. | **`Business`** — no change | Acceptable. The multi-role nature (bank vs. charity vs. broker) is controlled by the `BusinessEnumType` enum, not the table name. Consider `Organisation` as a softer alternative if the project moves beyond Australian-centric terminology. |

---

### 3.3 Bank Interest & Payments

| Current Name | What It Actually Stores | Proposed Name | Rationale |
|---|---|---|---|
| `BankInterest` | A **monthly liability record**: how much interest tax is owed for a given bank, month, year, and calendar period. Has `amountDue`. | **`BankInterestLiability`** | The existing name could be confused with "interest earned" (an asset). Adding `Liability` makes clear this is the *amount owed to the ATO*, not the income received. |
| `Payment` | A **payment made against a `BankInterestLiability`** — date paid, amount, linked business and liability. | **`BankInterestPayment`** | The current name `Payment` is dangerously generic: it has no domain context. Grepping `Payment` in the codebase returns matches across donation, zakat, and this table. Adding `BankInterest` as a prefix makes the foreign key relationship (`bankInterestId`) self-documenting. |

---

### 3.4 Zakat

| Current Name | What It Actually Stores | Proposed Name | Rationale |
|---|---|---|---|
| `Zakat` | A **per-calendar-year header** for zakat obligations: `amountDue` (calculated total) and a list of disbursement payments. One row per `calendarId` (`@unique`). | **`ZakatObligation`** | `Zakat` as a table name is too broad — it is the entire domain, not one record type. `ZakatObligation` names what the row *is*: a calculated obligation for one year. Alternatives: `ZakatRecord`, `ZakatLedger`. |
| `ZakatPayment` | An **actual disbursement** of zakat funds to a beneficiary (individual or business) — dated, with amount and beneficiary type. | **`ZakatPayment`** — no change | Already precise. It records a payment event. The only consideration is whether `ZakatDisbursement` better signals *charitable disbursement* vs. generic *payment*. Either is acceptable; `ZakatPayment` is shorter and consistent with `DonationPayment`. |

---

### 3.5 Donations

| Current Name | What It Actually Stores | Proposed Name | Rationale |
|---|---|---|---|
| `Donation` | A **per-calendar-year header** for donation tracking: links a `CalendarYear` to a list of payment records. Carries no amount of its own. One row per `calendarId` (`@unique`). | **`DonationLedger`** | `Donation` sounds like a single donation event with a dollar amount. In reality this row has no `amount` field — it is a fiscal-year container. `DonationLedger` signals "the ledger for this year's donations". Parallels `ExpenseLedger` and `ZakatObligation` in intent. |
| `DonationPayment` | An **actual donation payment** to a beneficiary — dated, amount, tax category, beneficiary type. | **`DonationPayment`** — no change | Clear and specific. Parallel with `ZakatPayment`. |

---

### 3.6 Income

> **Note (Issue D):** Income and Expense share identical structural patterns: a fiscal-year header with no amount, linked to line items. They are renamed in parallel.

| Current Name | What It Actually Stores | Proposed Name | Rationale |
|---|---|---|---|
| `Income` | A **per-user per-calendar-year header** for income tracking. Contains no amount — just the `calendarId` + `userId` container. One row per `@@unique([calendarId, userId])`. | **`IncomeLedger`** | Exact same reason as `Expense` → `ExpenseLedger`. `Income` sounds like a single income figure. This row has no `amount` field. `IncomeLedger` signals "the ledger collecting all income entries for this year". |
| `IncomeEntry` | An **individual income event**: a specific date earned, amount, and source (EMPLOYMENT, STOCKS, etc.). Has `dateEarned` — this is a real dated event, not an aggregate. | **`IncomeRecord`** | Unlike `ExpenseEntry` (which is a monthly aggregate), `IncomeEntry` stores individual timestamped income events. `IncomeRecord` better signals "one income event was recorded" without implying it is a line in an aggregate summary. Avoids the overloaded `Entry` suffix. |

---

### 3.7 Expenses

> **This is the highest-priority rename group.** The current names actively mislead about what data is stored.

| Current Name | What It Actually Stores | Proposed Name | Rationale |
|---|---|---|---|
| `ExpenseCategory` | A **global lookup table of expense categories** — name (unique), optional icon, active flag. | **`ExpenseCategory`** — no change | Already well-named as a category lookup. The `Category` suffix signals its lookup role. |
| `Expense` | A **per-user per-fiscal-year container** (header). Stores no amount, no transactions — only `calendarId` + `userId`. It is the parent record that `ExpenseEntry` rows link to. `@@unique([calendarId, userId])` ensures exactly one per year per user. | **`ExpenseLedger`** | `Expense` is the most misleading name in the schema. Any developer reading it will assume it holds an expense amount. It holds nothing financial — it is a folder. `ExpenseLedger` communicates "the ledger for this fiscal year's expense summaries". This also prevents confusion with the future `BankTransaction` table (Section 4), which will hold actual expense transactions. |
| `ExpenseEntry` | A **monthly budget summary line** — the *total spent* in one category in one month. Fields: `month` (1–12), `amount` (aggregated), `categoryId`, `expenseId`. This is NOT one transaction — it is `Σ(all transactions in Groceries, July) = $450`. | **`MonthlyExpenseSummary`** | This is the most semantically incorrect name in the schema. `Entry` implies a single event. This row is an aggregate. `MonthlyExpenseSummary` is unambiguous: one row = one category's total for one month. It also distinguishes cleanly from the proposed `BankTransaction` table (raw events) and from `IncomeRecord` (individual events). Alternative: `ExpenseSummaryLine` or `BudgetLine`. |

---

### 3.8 Calendar

| Current Name | What It Actually Stores | Proposed Name | Rationale |
|---|---|---|---|
| `CalendarYear` | A **named fiscal or calendar period** — `fromYear`, `fromMonth`, `toYear`, `toMonth`, type (`ZAKAT \| ANNUAL \| FISCAL`). Shared reference used by Income, Expense, Zakat, Donations, BankInterest. | **`CalendarYear`** — no change | Clear and accurate. The `type` enum handles the three period kinds (Islamic/Zakat year, calendar year, fiscal year). No rename needed. |

---

### 3.9 Bank Assets (Cash)

| Current Name | What It Actually Stores | Proposed Name | Rationale |
|---|---|---|---|
| `BankAccount` | A **user's named account at a bank** — e.g., "Savings", "Term Deposit". Links a `Business` (type=BANK) to a user. `@@unique([name, bankId, userId])`. | **`BankAccount`** — no change | Correct domain term. Clear and unambiguous. |
| `BankAssetSnapshot` | A **point-in-time snapshot header** — one per `snapshotDate` per user. Parent record for a set of account balance readings on that date. | **`BankBalanceSnapshot`** | `BankAsset` is slightly ambiguous — "asset" could refer to stocks or property. `BankBalance` is precise: this snapshot captures the cash balances held at banks on a given date. |
| `BankAssetEntry` | A **single account's balance at one snapshot** — `balance`, `accountId`, `snapshotId`. One per `@@unique([accountId, snapshotId])`. | **`BankBalanceRecord`** | Avoids the overloaded `Entry` suffix (P5). `Record` signals a point-in-time observation. `BankBalance` ties it to its parent snapshot. Alternative: `AccountBalanceReading` for maximum clarity. |

---

### 3.10 Stock Assets

| Current Name | What It Actually Stores | Proposed Name | Rationale |
|---|---|---|---|
| `StockSnapshot` | A **point-in-time portfolio snapshot header** — one per `snapshotDate` per user. Parent record for a set of holdings on that date. | **`PortfolioSnapshot`** | `StockSnapshot` is technically accurate but narrow. A "portfolio" framing is more natural in investment language and accommodates future expansion (e.g., ETFs, bonds). |
| `StockHolding` | A **single holding within a portfolio snapshot** — ticker, company, quantity, buy/sell prices, planned term, brokerage account. | **`StockHolding`** — no change | `StockHolding` is precise. Alternative: `PortfolioHolding` for parallelism with `PortfolioSnapshot`. Either is acceptable. |

---

### 3.11 AI / Import Infrastructure

> **Issue G:** `AIImportSession` is now used for both AI image imports and CSV imports. The `AI` prefix overstates the requirement for CSV sessions.

| Current Name | What It Actually Stores | Proposed Name | Rationale |
|---|---|---|---|
| `AIImportSession` | A **session tracking record for any file import operation** — image or CSV. Fields: `importType` (EXPENSE / BANK_ASSET / STOCK), `status`, `overallConfidence`, `recordsCreated`, `metadata` (stores CSV rows for CSV imports). | **`ImportSession`** | Remove the `AI` prefix. The session table is infrastructure for tracking any import attempt. CSV imports store their parsed rows in `metadata` and never call the vision API. The `AIUsageLog` table (which records actual AI token usage) remains `AI`-prefixed since it specifically tracks AI costs. |
| `ImportImage` | A **stored image file record** linked to an import session — `fileName`, `fileSize`, `mimeType`, `storageUrl`, `storageProvider`, confidence, extracted data. Used exclusively for AI image imports (not CSV). | **`ImportImage`** — no change | The name is accurate: it stores metadata about an uploaded image file. CSV imports do not create `ImportImage` rows. If PDF support is added in future, rename to `ImportFile` at that point. |
| `AIUsageLog` | A **record of AI token consumption** for one model call — `model`, `promptTokens`, `completionTokens`, `totalTokens`, `estimatedCostUSD`. | **`AIUsageLog`** — no change | Accurate. The `AI` prefix is appropriate here because this table exclusively tracks AI API costs. |

---

### 3.12 RAG / Category Mapping

> **Issue C:** `TransactionCategoryOverride` is one of the most opaque names in the schema. The `@@unique([userId, description])` constraint means it is structurally a dictionary, but the name implies a log of override events.

| Current Name | What It Actually Stores | Proposed Name | Rationale |
|---|---|---|---|
| `TransactionCategoryOverride` | A **per-user merchant-to-category dictionary** used to seed Phase 2 RAG. Each row maps one lowercased merchant description to one expense category name. The `@@unique([userId, description])` constraint enforces exactly one mapping per merchant per user — making it a dictionary, not a history. `source` field records whether the mapping was LLM-confirmed or user-overridden. | **`MerchantCategoryMap`** | Three improvements in one rename: (1) `Merchant` replaces `Transaction` — the row describes a merchant, not a transaction event; (2) `Category` is kept — it maps to a category; (3) `Map` replaces `Override` — the purpose is a reusable lookup dictionary, not an audit log of changes. The `@@unique` constraint is now obvious from the name. |

---

## 4. New Table Proposal — `BankTransaction`

### Problem

CSV bank statement import parses individual debit rows from CommBank exports. Currently:

- Parsed transactions are stored in `ImportSession.metadata` as raw JSON (temporary staging).
- After processing, transactions are **aggregated into `MonthlyExpenseSummary`** rows — e.g., all "Woolworths" debits in July become one `MonthlyExpenseSummary` row for Groceries/July.
- The **raw individual transactions are discarded** — no permanent record exists.

This creates gaps:

| Gap | Impact |
|-----|--------|
| No audit trail | Cannot verify that `MonthlyExpenseSummary.amount` matches the sum of imported CSV rows |
| No reconciliation | Cannot compare imported total against bank statement "total debits" figure |
| No drill-down | UI cannot show "what transactions make up this $450 Groceries/July figure?" |
| No re-categorisation | Cannot reprocess categorisation decisions on historical transactions |
| Phase 3 dependency | `MerchantCategoryMap` (RAG seed) is enriched from transaction history — but if transactions aren't stored, the enrichment has no stable source |

### Proposed Schema

```prisma
// Raw bank transaction imported from CSV — one row per CSV debit line
model BankTransaction {
  id          String   @id @default(cuid())

  // When and what
  date        DateTime                       // parsed from CSV "Date" column (DD/MM/YYYY)
  description String                         // raw merchant description from CSV (untransformed)
  amount      Decimal  @db.Money             // positive absolute value of debit

  // Categorisation result
  categoryId  String                         // matched ExpenseCategory.id
  category    ExpenseCategory @relation(fields: [categoryId], references: [id])
  matchMethod String?                        // "exact" | "llm" | "user_override"
  confidence  Float?                         // embedding similarity score (0–1) if applicable

  // Aggregation link — which MonthlyExpenseSummary this transaction rolled up into
  // Nullable: not yet aggregated if import is partial
  expenseSummaryId String?
  expenseSummary   MonthlyExpenseSummary? @relation(fields: [expenseSummaryId], references: [id])

  // Import provenance
  importSessionId String
  importSession   ImportSession @relation(fields: [importSessionId], references: [id], onDelete: Cascade)

  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId, date])
  @@index([importSessionId])
  @@index([userId, categoryId])
  @@index([expenseSummaryId])
}
```

### How It Relates to Other Tables

```
CSV File
   │
   ▼
ImportSession             ← session tracking (status, metadata)
   │
   ├──► BankTransaction[]    ← one row per debit line in the CSV (NEW)
   │         │
   │         │  aggregated by (month, category)
   │         ▼
   └──► MonthlyExpenseSummary[]   ← one row per category per month (currently ExpenseEntry)
               │
               └── parent: ExpenseLedger   ← fiscal-year container (currently Expense)

MerchantCategoryMap        ← dictionary: description → category (seeded FROM BankTransaction rows)
```

### Relationship to `MerchantCategoryMap`

`MerchantCategoryMap` is a **write-through cache**: when a `BankTransaction` is confirmed (either by the LLM or by the user), the `(userId, description, category)` mapping is upserted into `MerchantCategoryMap`. On the *next* import, the RAG lookup hits `MerchantCategoryMap` first before calling the embedding API.

- `BankTransaction` stores the **event** (something happened on a date for an amount).
- `MerchantCategoryMap` stores the **learned rule** (this merchant always maps to this category).

### `ImportTypeEnum` extension

Add `CSV_EXPENSE` to the existing `ImportTypeEnum` to distinguish sessions:

```prisma
enum ImportTypeEnum {
  EXPENSE        // AI image-based expense import
  BANK_ASSET
  STOCK
  CSV_EXPENSE    // ← new: CSV bank statement import targeting expense ledger
}
```

---

## 5. Summary Rename Map

Quick reference: old name → proposed new name, and whether the PostgreSQL table name changes.

| Old Model Name | New Model Name | DB Table Change? | Priority |
|---|---|---|---|
| `Example` | Drop (or `HealthCheck`) | Yes — drop table | Low |
| `Relationship` | `RelationshipType` | Yes (or use `@@map`) | Medium |
| `BankInterest` | `BankInterestLiability` | Yes (or use `@@map`) | Medium |
| `Payment` | `BankInterestPayment` | Yes (or use `@@map`) | **High** — name is dangerously generic |
| `Zakat` | `ZakatObligation` | Yes (or use `@@map`) | Medium |
| `Donation` | `DonationLedger` | Yes (or use `@@map`) | Medium |
| `Income` | `IncomeLedger` | Yes (or use `@@map`) | **High** — parallel with Expense |
| `IncomeEntry` | `IncomeRecord` | Yes (or use `@@map`) | **High** — parallel with Expense |
| `Expense` | `ExpenseLedger` | Yes (or use `@@map`) | **Critical** — actively misleading |
| `ExpenseEntry` | `MonthlyExpenseSummary` | Yes (or use `@@map`) | **Critical** — actively misleading |
| `BankAssetSnapshot` | `BankBalanceSnapshot` | Yes (or use `@@map`) | Low |
| `BankAssetEntry` | `BankBalanceRecord` | Yes (or use `@@map`) | Low |
| `StockSnapshot` | `PortfolioSnapshot` | Yes (or use `@@map`) | Low |
| `AIImportSession` | `ImportSession` | Yes (or use `@@map`) | Medium |
| `TransactionCategoryOverride` | `MerchantCategoryMap` | Yes (or use `@@map`) | **High** — RAG feature depends on correct mental model |
| *(new)* | `BankTransaction` | New table | **High** — needed for audit trail and totals reconciliation |

**No change proposed for:** `Account`, `Session`, `VerificationToken`, `User`, `Individual`, `Business`, `ZakatPayment`, `DonationPayment`, `ExpenseCategory`, `CalendarYear`, `BankAccount`, `StockHolding`, `ImportImage`, `AIUsageLog`.

---

## 6. Migration Impact Summary

### Strategy A — Model rename only, preserve DB table names (`@@map`)

Add `@@map("OldTableName")` to each renamed model. The PostgreSQL table name stays unchanged; only the Prisma client API changes (e.g., `prisma.expense` → `prisma.expenseLedger`).

**Pros:** No `prisma migrate` required; no data migration risk; DB stays identical.  
**Cons:** TypeScript codebase must be updated everywhere (services, routers, models, types, tests). Prisma-generated types change (e.g., `Prisma.ExpenseWhereInput` → `Prisma.ExpenseLedgerWhereInput`).

### Strategy B — Rename model AND DB table

Remove the `@@map` directive (or add one pointing to the new name). Run `prisma migrate dev` to generate an `ALTER TABLE RENAME` migration.

**Pros:** DB table names match code; cleaner long-term.  
**Cons:** Requires coordinated deploy (migration + code deploy must be atomic); any raw SQL queries, views, or external tools break.

**Recommendation:** Use **Strategy A** (model-only rename via `@@map`) for all renames. Schedule a second pass to drop the `@@map` directives and rename the DB tables once the team is confident.

---

### File-by-file impact of Critical renames (`Expense → ExpenseLedger`, `ExpenseEntry → MonthlyExpenseSummary`)

| File | Change Required |
|---|---|
| `prisma\schema.prisma` | Rename models; add `@@map("Expense")`, `@@map("ExpenseEntry")` |
| `src\server\services\expense.service.ts` | All `prisma.expense.*` → `prisma.expenseLedger.*`; all `prisma.expenseEntry.*` → `prisma.monthlyExpenseSummary.*`; all `Prisma.ExpenseEntryWhereInput` type refs |
| `src\server\models\expense.ts` | Rename `ExpenseModel`, `ExpenseEntryModel`, `ExpenseEntryInput`, `ExpenseEntryWithCategory` types |
| `src\server\services\ai-import\expense-mapper.service.ts` | All `prisma.expense` / `prisma.expenseEntry` references |
| `src\app\api\csv-import\confirm\route.ts` | All `ExpenseEntry` / `Expense` references |
| `src\app\api\csv-import\upload\route.ts` | Session metadata field references |
| `src\server\trpc\router\*` | Any router that queries expense tables (currently expense is accessed via service layer only) |
| `src\server\schema\*` | Zod schemas that reference `ExpenseEntry` shape |
| `src\__tests__\*` | All unit/integration tests using `prisma.expense` or `prisma.expenseEntry` |
| `spec\csv-categorisation-llm-classification\*.md` | Documentation references to `Expense` / `ExpenseEntry` model names |

### File-by-file impact of `AIImportSession → ImportSession`

| File | Change Required |
|---|---|
| `prisma\schema.prisma` | Rename model; add `@@map("AIImportSession")` |
| `src\app\api\ai-import\*\route.ts` | `prisma.aIImportSession.*` → `prisma.importSession.*` |
| `src\app\api\csv-import\*\route.ts` | Same |
| `src\server\trpc\router\ai-usage.ts` | Any session queries |
| `src\__tests__\*` | Test fixtures and mocks referencing `AIImportSession` |

### File-by-file impact of `TransactionCategoryOverride → MerchantCategoryMap`

| File | Change Required |
|---|---|
| `prisma\schema.prisma` | Rename model; add `@@map("TransactionCategoryOverride")` |
| `src\app\api\csv-import\confirm\route.ts` | `prisma.transactionCategoryOverride.*` → `prisma.merchantCategoryMap.*` |
| `src\server\services\ai-import\*` | Any service files using the override table |
| `src\__tests__\*` | Test fixtures |

### Impact classification

| Category | Tables | Impact Level |
|---|---|---|
| No DB migration, TS rename only (Strategy A) | All 14 renames above | Medium — touch many files but zero data risk |
| New table + migration | `BankTransaction` | Low risk — additive only |
| Breaking change to tRPC API surface | None (all accessed through service layer) | None |
| NextAuth adapter breakage | `Account`, `Session`, `VerificationToken`, `User` | Do not rename — avoid entirely |

---

## 7. Open Questions

These questions must be answered before implementation begins.

| # | Question | Context | Recommended Default |
|---|---|---|---|
| Q1 | **`Expense` → `ExpenseLedger` or `ExpenseRecord`?** | `Ledger` signals an accounting book (recurring/aggregate). `Record` signals a single stored fact. The table IS a per-year container (ledger-like). | **`ExpenseLedger`** |
| Q2 | **`ExpenseEntry` → `MonthlyExpenseSummary` or `ExpenseSummaryLine` or `BudgetLine`?** | `MonthlyExpenseSummary` is maximally descriptive. `ExpenseSummaryLine` is shorter. `BudgetLine` is domain-accurate but loses the "expense" context. | **`MonthlyExpenseSummary`** |
| Q3 | **`IncomeEntry` → `IncomeRecord` or `IncomeLine`?** | `IncomeRecord` (individual dated event). `IncomeLine` for strict parallelism with the expense line rename. `IncomeEntry` has a real `dateEarned` — it is NOT aggregated. | **`IncomeRecord`** |
| Q4 | **Rename `StockSnapshot` → `PortfolioSnapshot` or leave it?** | Cosmetic improvement. No semantic confusion with current name. | **Leave as `StockSnapshot`** — low value, defer |
| Q5 | **`BankTransaction` table — store ALL transactions or only confirmed/categorised ones?** | Storing all (including unconfirmed) enables full audit but increases storage. Storing only confirmed simplifies the schema. | **All transactions** — enables reconciliation against bank CSV totals |
| Q6 | **Should `BankTransaction` link to `MonthlyExpenseSummary` via FK, or only implied by `(userId, month, categoryId)`?** | FK gives referential integrity and enables cascade deletes. Implicit link is simpler. | **FK** (`expenseSummaryId`) with `onDelete: SetNull` |
| Q7 | **`ImportTypeEnum` — add `CSV_EXPENSE` or reuse `EXPENSE` for CSV sessions?** | Currently `EXPENSE` is used for both AI image expense imports and CSV imports. Adding `CSV_EXPENSE` enables separate reporting in the AI Spend page. | **Add `CSV_EXPENSE`** — clean separation |
| Q8 | **Strategy A (`@@map`) vs Strategy B (rename DB tables) — when to cut over?** | Strategy A is safer for immediate work. Strategy B cleans up but requires coordinated deploy. | **Strategy A now, Strategy B in a dedicated "schema cleanup" sprint** |
| Q9 | **Drop `Example` or keep as `HealthCheck`?** | `Example` has no production use. Dropping removes the unused table. Keeping as `HealthCheck` provides a no-stakes DB ping target. | **Drop** — remove in the same migration as the first rename batch |
| Q10 | **`Business` → `Organisation`?** | Lower priority. `Business` is accurate for current use. `Organisation` is softer and more internationally neutral. | **Leave as `Business`** — defer until after core renames |

---

*End of document.*
