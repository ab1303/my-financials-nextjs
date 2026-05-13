# Transactions Feature — High Level Design

**Version:** 1.0  
**Status:** Approved  
**Feature:** `/cashflow/transactions` — Universal Import Hub  

---

## 1. Problem Statement

Two import wizards (CSV and AI Image) are currently embedded as modal dialogs inside the **Expenses** page. This creates three structural problems:

| Problem | Impact |
|---|---|
| **Wrong abstraction** | CSV files are full bank statements (debits + credits), not "expense files" |
| **Data loss** | Credits (income, transfers) are silently dropped by the CSV wizard |
| **Poor discoverability** | No single entry point for all financial import workflows |

---

## 2. Solution Overview

Introduce `/cashflow/transactions` as a **first-class nav item** under Cashflow. It becomes the universal import hub for all bank-originated data.

```
BEFORE                              AFTER
──────────────────────────          ──────────────────────────────────────
Cashflow                            Cashflow
  ├── Income                          ├── Income
  ├── Donations                       ├── Donations
  ├── Expenses  ← wizards live here   ├── Expenses  ← aggregate view only
  └── Bank Interest                   ├── Transactions  ← NEW (import hub)
                                      └── Bank Interest
```

The **Expenses page** shrinks to a pure aggregate reporting view with a single `Import transactions →` link pointing to the new page.

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              /cashflow/transactions (Page)               │
│                                                          │
│   ┌──────────────────┐   ┌──────────────────────────┐  │
│   │  CSV Import Card  │   │  AI Receipt Import Card   │  │
│   └────────┬─────────┘   └────────────┬─────────────┘  │
│            │                          │                  │
│   ┌────────▼─────────┐   ┌────────────▼─────────────┐  │
│   │  CSVImportWizard  │   │      AIImportWizard       │  │
│   │  (moved from      │   │   (moved + Review step    │  │
│   │   Expenses page)  │   │    added before save)     │  │
│   └────────┬─────────┘   └────────────┬─────────────┘  │
└────────────┼──────────────────────────┼─────────────────┘
             │                          │
   ┌─────────▼──────────────────────────▼──────────┐
   │            /api/transactions/                  │
   │  ┌─────────────────┐  ┌──────────────────┐    │
   │  │  csv/            │  │  ai/             │    │
   │  │  upload          │  │  upload          │    │
   │  │  classify (SSE)  │  │  parse (SSE)     │    │
   │  │  confirm         │  │  confirm         │    │
   │  └────────┬─────────┘  └────────┬─────────┘   │
   └───────────┼────────────────────┼───────────────┘
               │                    │
   ┌───────────▼────────────────────▼───────────────┐
   │              Database Writes                     │
   │                                                  │
   │  DEBIT confirmed  → MonthlyExpenseSummary        │
   │  CREDIT confirmed → IncomeRecord                 │
   │  ALL transactions → Transaction (audit log)      │
   └──────────────────────────────────────────────────┘
```

---

## 4. Data Model Changes

### New model: `Transaction` (audit log)

Every confirmed (or excluded) line item from any import is stored as a `Transaction` record. This is the audit trail.

| Field | Type | Notes |
|---|---|---|
| `type` | `DEBIT \| CREDIT` | Derived from CSV sign; always DEBIT for AI image imports |
| `amount` | `Decimal @db.Money` | Always positive absolute value |
| `category` | `String` | Expense category name (DEBIT), or IncomeSourceEnumType label / "Transfer" / "Excluded" (CREDIT) |
| `status` | `PENDING \| CONFIRMED \| EXCLUDED` | CONFIRMED = downstream record written; EXCLUDED = no downstream write |
| `bankAccountId` | `String?` | Required for CSV; nullable for AI image (no account selected) |
| `importSessionId` | `String?` | Links back to the `ImportSession` for audit |

### Downstream records (unchanged models)

| Transaction type | Downstream write |
|---|---|
| DEBIT, CONFIRMED | `ExpenseLedger` → `MonthlyExpenseSummary` (aggregate, upserted) |
| CREDIT, CONFIRMED | `IncomeLedger` → `IncomeRecord` (individual record) |
| CREDIT, EXCLUDED | No downstream write; `Transaction` record only |

---

## 5. Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| CSV bank account | **Required** | A CSV statement is account-scoped — no account = no audit trail |
| AI image bank account | **Optional** | Receipts are not tied to one account; defaults to null / "Unknown" |
| CSV credits routing | LLM → `IncomeSourceEnumType` or `"Transfer"` / `"Excluded"` | Income is already modelled; credits must be acknowledged, not dropped |
| AI import Review step | **New step added** before save | CSV has review; AI should too — consistency and user control |
| `calendarYearId` | **Resolved from transaction dates** | Transactions page has no fiscal year selector; wizard is self-contained |
| Phase 1 scope | **Import only** (no transaction list view) | Deliver value quickly; `Transaction` table created for Phase 2 UI |
| Old wizard retirement | Retire **after** Transactions is tested | Safety — no big-bang delete |

---

## 6. High-Level Data Flows

### 6.1 CSV Import Flow

```
Select bank account
      ↓
Drop CSV file → POST /api/transactions/csv/upload
      ↓   (parses CommBank CSV, creates ImportSession)
SSE stream → POST /api/transactions/csv/classify
      ↓   (LLM classifies debits as expense categories,
      │    credits as IncomeSourceEnumType / Transfer / Excluded)
Review UI — Expenses tab + Income/Credits tab
      ↓   (user can override any LLM suggestion)
POST /api/transactions/csv/confirm
      ↓
Debits  → MonthlyExpenseSummary + Transaction(DEBIT, CONFIRMED)
Credits → IncomeRecord + Transaction(CREDIT, CONFIRMED)
         OR Transaction(CREDIT, EXCLUDED)
      ↓
Results summary (debit/credit split)
```

### 6.2 AI Image Import Flow

```
[Optional] Select bank account
      ↓
Drop receipt images → POST /api/transactions/ai/upload
      ↓
SSE stream → POST /api/transactions/ai/parse
      ↓   (GPT-4o Vision extracts; does NOT save)
NEW: Review step — per-image entries with checkboxes + category dropdowns
      ↓   (user confirms/deselects entries)
POST /api/transactions/ai/confirm
      ↓
Confirmed entries → MonthlyExpenseSummary + Transaction(DEBIT, CONFIRMED)
      ↓
Results with per-image confidence scores
```

---

## 7. Component Structure

```
/cashflow/transactions/
  page.tsx          ← Server Component: fetches bankAccounts
  layout.tsx        ← passthrough
  _components/
    csv/
      CSVImportWizard.tsx         (moved from Expenses; adds bankAccountId)
      CSVUploadStep.tsx           (adds bank account selector)
      CSVClassifyingStep.tsx      (handles new credit_classified SSE event)
      CSVTransactionReviewTable.tsx  ← NEW (tabbed: debits | credits)
      CSVResultsStep.tsx          (minor: shows debit/credit split)
      _types.ts
    ai/
      AIImportWizard.tsx          (moved; adds optional bankAccountId + review step)
      UploadStep.tsx              (adds optional bank selector)
      ProcessingStep.tsx          (emits 'extracted' not 'saved')
      ReviewStep.tsx              ← NEW
      ResultsStep.tsx             (unchanged)
      ConfidenceBadge.tsx         (copy verbatim)
      _types.ts / _schema.ts
```

---

## 8. API Route Structure

```
/api/transactions/
  csv/
    upload/route.ts    POST — file + bankAccountId → ImportSession
    classify/route.ts  POST SSE — groups by month, LLM classifies debits+credits
    confirm/route.ts   POST — writes MonthlyExpenseSummary + IncomeRecord + Transaction
  ai/
    upload/route.ts    POST — images + optional bankAccountId → image storage
    parse/route.ts     POST SSE — GPT-4o extract ONLY (no DB write)
    confirm/route.ts   POST — writes MonthlyExpenseSummary + Transaction
```

---

## 9. Migration Strategy (4 Phases)

| Phase | What | Risk |
|---|---|---|
| **A — Build** | New page, API routes, components, Prisma model | Low — additive only |
| **B — Navigation** | Add Transactions to SideNav | Low |
| **C — Retire wizards from Expenses** | Remove wizards from ExpenseTableClient; add redirect link | Medium — test first |
| **D — Delete old API routes** | Remove `/api/csv-import/*` and `/api/ai-import/*` | Low (after C stable) |

> **Do NOT** delete old API routes in the same PR as Phase C. Return `410 Gone` from old routes during the grace period.

---

## 10. Out of Scope (Phase 1)

- Transaction list/table view (Phase 2)
- Editing or deleting confirmed Transaction records
- Transaction deduplication
- Multi-account reconciliation view
- CSV formats other than CommBank (`Date, Amount, Description, Balance`)
- Bulk import session history page
- RAG auto-classification using MerchantCategoryMap (written in Phase 1, read in Phase 2)

---

## 11. Files Affected Summary

| Category | Count |
|---|---|
| New files to create | ~15 |
| Existing files to modify | ~5 |
| Files to retire (after Phase C) | ~12 |
| Prisma migrations | 1 (`add_transaction_model`) |

> Full file inventory: see `transactions-context.md` §2 and `lld.md` per-phase task lists.
