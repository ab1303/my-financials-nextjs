# Transactions Feature Refactoring Summary

**Date:** 2026-05-13  
**Project:** my-financials-nextjs (Next.js T3 Stack)  
**Scope:** Multi-phase refactoring to move CSV and AI import wizards from the Expenses page into a new universal `/cashflow/transactions` import hub.

---

## Overview

This refactoring unified the import experience across the application by:

1. **Centralizing import infrastructure** — Created a new `/cashflow/transactions` page as the single entry point for all transaction imports (CSV and AI)
2. **Modernizing the data model** — Added a `Transaction` model to Prisma to track all imported transactions with their source, type, and status
3. **Extending CSV capabilities** — Enhanced CSV processing to handle both debit and credit transactions, with LLM-powered classification for income sources
4. **Improving user experience** — Built dedicated wizards for CSV and AI imports with per-transaction review, category override, and amount editing
5. **Deprecating legacy APIs** — Returned 410 Gone for old `/api/csv-import/*` and `/api/ai-import/*` routes, centralizing all imports under `/api/transactions/*`
6. **Fixing dependency issues** — Resolved broken shared component references that arose during cleanup

The refactoring spans **4 phases (A–D)** and addresses a critical shared component issue discovered during post-build validation.

---

## The ai-import Shared Component Issue

### Problem

During Phase C (cleanup), task C2 deleted two directories that hosted shared components used across multiple features:

- `src/app/(authorized)/cashflow/expense/_components/ai-import/` — contained 10 files
- `src/app/(authorized)/cashflow/expense/_components/csv-import/` — contained 6 files

**Impact:** These components were imported by **three other parts of the codebase**, causing a **5-error Turbopack build failure** with "Module not found" errors.

**Dependent components:**

| Feature | Component | Imports |
|---------|-----------|---------|
| **Bank Assets** | `BankAssetAIImportWizard.tsx` | `UploadStep`, `ProcessingStep`, `ResultsStep`, wizard types (`BankAssetAIImportWizardProps`, `BankAssetImportContext`, `WizardStep`, `UploadedFile`, `ImportSessionResult`) |
| **Bank Assets** | `BankAssetsClient.tsx` | `ImportAuditIcon` |
| **Expense** | `CategoryBreakdownModal.tsx` | `ImportAuditIcon` |

### Root Cause

The old `expense/_components/ai-import/` directory functioned as a **de-facto shared component library**, but was co-located under the expense feature rather than in a proper shared location. When the refactoring correctly moved all AI import infrastructure to the new `transactions` feature, it left the bank feature and other expense components without access to these dependencies.

The issue highlights a **co-location boundary problem**: shared components should never be nested inside feature-specific directories, as they become invisible to dependency analysis and are easily deleted during cleanup.

### Resolution

Four targeted fixes restored functionality without compromising the refactoring's architecture:

#### 1. Created `src/components/ImportAuditIcon.tsx`

Moved the shared audit icon component to the proper shared component location. This simple component displays a bot icon for entries that were AI-imported.

**Location:** `src/components/ImportAuditIcon.tsx`  
**Status:** Shared component, used by multiple features

#### 2. Updated Import Paths

Updated two files to import from the new shared location:

- `src/app/(authorized)/cashflow/expense/_components/CategoryBreakdownModal.tsx`: Changed import from `./ai-import/ImportAuditIcon` to `@/components/ImportAuditIcon`
- `src/app/(authorized)/cashflow/bank/_components/BankAssetsClient.tsx`: Changed import from `../expense/_components/ai-import/ImportAuditIcon` to `@/components/ImportAuditIcon`

#### 3. Refactored `BankAssetAIImportWizard.tsx`

Adapted the bank feature to use the new transactions wizard infrastructure:

- **Import sources changed to transactions feature:**
  - `UploadStep` and `ResultsStep` from `../../transactions/_components/ai/` (reusing the new wizard steps with compatible props)
  - Types (`UploadedFile`, `AIImportSessionResult`) from `../../transactions/_components/ai/_types`

- **Bank-specific types moved inline:**
  - `BankAssetAIImportWizardProps`
  - `WizardStep` enum
  - `BankAssetImportContext`

- **Processing logic updated:**
  - Now uses new `BankAIProcessingStep` component instead of the old shared `ProcessingStep`
  - Routes to `/api/transactions/ai/upload` and `/api/transactions/ai/parse` (not deprecated routes)

#### 4. Created `src/app/(authorized)/cashflow/bank/_components/BankAIProcessingStep.tsx`

Bank-specific processing step that integrates with the transactions API layer:

- Calls `/api/transactions/ai/upload` to upload receipt images
- Calls `/api/transactions/ai/parse` (SSE) to extract transaction data
- Auto-confirms transactions without a review step (bank assets don't require user review of extracted items)
- Uses parallel API calls for optimal performance

**Status:** Bank-specific component; maintains bank feature isolation while reusing transactions infrastructure

---

## Full Refactoring Summary

### Phase A: Backend + API Layer

#### A1 — Prisma Transaction Model

**What:** Added a new `Transaction` model to track all imported transactions.

**Files Changed:**
- `prisma/schema.prisma`: Added `Transaction` model with fields for type, source, status, amount, category, and references to `BankAccount` and `ImportSession`
- Created migration: `20250513121453_add_transaction_model`

**Key Details:**
- Three new enums: `TransactionTypeEnum` (DEBIT/CREDIT), `TransactionSourceEnum` (CSV/AI/MANUAL), `TransactionStatusEnum` (PENDING/CONFIRMED/EXCLUDED)
- Added back-references on `User`, `BankAccount`, and `ImportSession` models
- Full-text indexing on transaction descriptions for future search capabilities

#### A2 — CSV Parser Enhancement: DEBIT/CREDIT Classification

**What:** Extended the CSV parser to classify transactions as DEBIT or CREDIT based on amount sign.

**Files Changed:**
- `src/server/services/ai-import/_types.ts`: Added `type: 'DEBIT' | 'CREDIT'` to `CsvTransaction` interface
- `src/server/services/ai-import/csv-parser.service.ts`: Updated `parseCsvRow()` logic
- `src/__tests__/unit/csv-parser.test.ts`: Updated unit tests for new classification

**Key Details:**
- Negative amounts → DEBIT
- Positive amounts → CREDIT
- **Breaking change:** Old behavior filtered out credits; new behavior includes them in the transaction stream
- Maintains backward compatibility with existing bank account formats

#### A3 — Credit Transaction Classification (LLM-Powered)

**What:** Added AI-powered classification for credit transactions to identify income sources.

**Files Changed:**
- `src/server/services/ai-import/_types.ts`: Added `ClassifiedTransactionV2`, `ClassifiedCreditTransaction`, `ClassifiedCreditMonth` types
- `src/server/services/ai-import/csv-classifier.service.ts`: Implemented `classifyCreditTransactions()` function
- `src/__tests__/unit/csv-classifier.service.test.ts`: TDD unit tests

**Key Details:**
- Uses LLM to classify credit descriptions against `CREDIT_LABELS` (predefined income source labels)
- Falls back to `'OTHER'` category if classification is unclear
- Validates output against allowed labels to prevent hallucinations
- Includes comprehensive unit test coverage

#### A4 — CSV Confirm Service

**What:** Created service to persist classified CSV transactions to the database.

**Files Changed:**
- `src/server/services/transactions/_types.ts`: New file with `DebitMonth`, `CreditMonth`, `MonthError`, `TransactionSaveResult` types
- `src/server/services/transactions/csv-confirm.service.ts`: New service with two functions
- `src/__tests__/unit/csv-confirm.service.test.ts`: TDD unit tests

**Key Details:**
- `confirmDebitTransactions()`: Writes to `ExpenseLedger` → `MonthlyExpenseSummary` → `Transaction` (DEBIT source)
- `confirmCreditTransactions()`: Writes to `IncomeLedger` → `IncomeRecord` → `Transaction` (CREDIT source); excludes Transfer/Excluded categories
- Full test coverage for success and error paths

#### A5 — CSV Import API Routes

**What:** Created the new CSV import API layer.

**Files Created:**
- `src/app/api/transactions/csv/upload/route.ts`: File upload and `ImportSession` creation
- `src/app/api/transactions/csv/classify/route.ts`: SSE stream that processes transactions
- `src/app/api/transactions/csv/confirm/route.ts`: Persists classified transactions

**Key Details:**

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/transactions/csv/upload` | POST | Validates `bankAccountId`, creates `ImportSession`, stores CSV file |
| `/api/transactions/csv/classify` | POST | SSE stream; splits transactions into debits/credits; emits `debit_classified` and `credit_classified` events; final `done` event includes `incomeSourceLabels` |
| `/api/transactions/csv/confirm` | POST | Calls both `confirmDebitTransactions()` and `confirmCreditTransactions()`; logs AI usage; returns summary (debitsSaved, creditsSaved, creditsExcluded) |

#### A6 — AI Import API Routes

**What:** Created the new AI (receipt/image) import API layer.

**Files Created:**
- `src/app/api/transactions/ai/upload/route.ts`: Image upload endpoint
- `src/app/api/transactions/ai/parse/route.ts`: Extract-only parsing (no DB writes)
- `src/app/api/transactions/ai/confirm/route.ts`: Review and confirmation

**Key Details:**

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/transactions/ai/upload` | POST | Validates images; calls Claude Vision; creates `ImportSession` with status PROCESSING; optional `bankAccountId` for bank asset imports |
| `/api/transactions/ai/parse` | POST | Extract-only (no DB writes); emits `extracted` SSE event with parsed transactions; updates session status to PROCESSING |
| `/api/transactions/ai/confirm` | POST | Writes `MonthlyExpenseSummary` + `Transaction(DEBIT, CONFIRMED)` records after user review; updates session status to COMPLETED |

### Phase A: Frontend

#### A7 — Transactions Page & Layout

**What:** Created the main transactions import hub page.

**Files Created:**
- `src/app/(authorized)/cashflow/transactions/layout.tsx`: Consistent layout with gray background and navigation
- `src/app/(authorized)/cashflow/transactions/page.tsx`: Server Component that fetches bank accounts
- `src/app/(authorized)/cashflow/transactions/_components/TransactionsClient.tsx`: Client Component with two import cards (CSV, AI)

**Key Details:**
- Serves as the single import hub for all transaction sources
- Displays available bank accounts and import options
- Routes to CSV and AI wizards based on user selection
- Maintains consistent styling with other Cashflow pages

#### A8 — CSV Import Wizard Components

**What:** Created complete 4-step CSV import wizard.

**Files Created:**
- `src/app/(authorized)/cashflow/transactions/_components/csv/_types.ts`: Type definitions
- `src/app/(authorized)/cashflow/transactions/_components/csv/_schema.ts`: Zod validation schemas
- `src/app/(authorized)/cashflow/transactions/_components/csv/CSVImportWizard.tsx`: Main orchestrator
- `src/app/(authorized)/cashflow/transactions/_components/csv/CSVUploadStep.tsx`: Upload interface
- `src/app/(authorized)/cashflow/transactions/_components/csv/CSVClassifyingStep.tsx`: SSE consumer
- `src/app/(authorized)/cashflow/transactions/_components/csv/CSVResultsStep.tsx`: Success summary
- `src/app/(authorized)/cashflow/transactions/_components/csv/CSVTransactionReviewTable.tsx`: Per-transaction review UI

**Wizard Flow:**

```
1. Upload → Select bank account & upload CSV file
2. Classifying → Debit/credit classification; LLM processing for income sources
3. Review → Per-row category override, per-row amount editing (Expenses/Income tabs)
4. Results → Summary of saved transactions (debitsSaved, creditsSaved, creditsExcluded)
```

**Key Details:**
- Bank account selector with validation
- Tabbed review interface (Expenses and Income tabs)
- Per-row category overrides (with autocomplete from existing categories)
- Per-row amount editing with validation
- Enhanced shared `TransactionReviewTable` with optional `onUpdateMonths` callback

#### A9 — AI Import Wizard Components

**What:** Created complete 4-step AI (receipt) import wizard.

**Files Created:**
- `src/app/(authorized)/cashflow/transactions/_components/ai/_types.ts`: Type definitions
- `src/app/(authorized)/cashflow/transactions/_components/ai/_schema.ts`: Zod validation schemas
- `src/app/(authorized)/cashflow/transactions/_components/ai/ConfidenceBadge.tsx`: Confidence indicator
- `src/app/(authorized)/cashflow/transactions/_components/ai/ImageRedactor.tsx`: PII redaction UI
- `src/app/(authorized)/cashflow/transactions/_components/ai/UploadStep.tsx`: Image/receipt upload
- `src/app/(authorized)/cashflow/transactions/_components/ai/ProcessingStep.tsx`: SSE consumer for extraction
- `src/app/(authorized)/cashflow/transactions/_components/ai/ReviewStep.tsx`: **NEW** — Per-entry review (NEW PHASE A9)
- `src/app/(authorized)/cashflow/transactions/_components/ai/ResultsStep.tsx`: Success summary
- `src/app/(authorized)/cashflow/transactions/_components/ai/AIImportWizard.tsx`: Main orchestrator

**Wizard Flow:**

```
1. Upload → Select optional bank account & upload receipt images
2. Processing → Extract transaction data via Claude Vision
3. Review → Per-transaction review with:
   - Checkbox for include/exclude
   - Category selector (with autocomplete)
   - Amount editor (allow override of extracted value)
   - Confidence badge
4. Results → Summary of created transactions
```

**Key Details:**
- Optional bank account selector (for bank asset imports)
- Image redaction support for PII protection
- Confidence badges for extraction quality
- Per-transaction review with full edit capabilities
- Calls new `/api/transactions/ai/confirm` after review (not deprecated routes)

### Phase B: Navigation

#### B1 — SideNav Update

**What:** Added new Transactions link to main navigation.

**Files Changed:**
- `src/layouts/SideNav.tsx`: Added navigation item for `/cashflow/transactions`

**Changes:**
- Added `ArrowLeftRight` icon from lucide-react
- Added "Transactions" nav item to `cashflowItems` array
- Updated `defaultOpen` condition to include `/cashflow/transactions` for Cashflow accordion

---

### Phase C: Cleanup

#### C1 — ExpenseTableClient Cleanup

**What:** Removed import buttons from Expense feature, replacing them with link to Transactions hub.

**Files Changed:**
- `src/app/(authorized)/cashflow/expense/_components/ExpenseTableClient.tsx`

**Changes:**
- Removed `AIImportWizard` and `CSVImportWizard` component imports
- Removed `isImportWizardOpen` and `isCSVImportWizardOpen` state variables
- Removed "CSV Import" and "AI Import" button elements
- Added new button: `<Link href="/cashflow/transactions">Import transactions →</Link>`

**Result:** Clean separation of concerns; all imports now flow through the dedicated transactions hub.

#### C2 — Delete Old Wizard Directories

**What:** Removed legacy import components now consolidated in transactions feature.

**Files Deleted:**
- `src/app/(authorized)/cashflow/expense/_components/csv-import/` (6 files)
  - `CSVImportWizard.tsx`, `CSVUploadStep.tsx`, `CSVClassifyingStep.tsx`, `CSVResultsStep.tsx`, `_types.ts`, `_schema.ts`
- `src/app/(authorized)/cashflow/expense/_components/ai-import/` (10 files)
  - `AIImportWizard.tsx`, `UploadStep.tsx`, `ProcessingStep.tsx`, `ResultsStep.tsx`, `ConfidenceBadge.tsx`, `ImageRedactor.tsx`, `ImportAuditIcon.tsx`, `_types.ts`, `_schema.ts`, legacy integration test files

**Integration Tests Deleted:**
- `src/__tests__/integration/csv-import-upload.integration.test.ts`
- `src/__tests__/integration/csv-import-parse.integration.test.ts`

**Note:** This cleanup triggered the shared component issue (resolved in Post-Build Fixes).

---

### Phase D: API Deprecation

#### D1 — Legacy API Routes → 410 Gone

**What:** Deprecated old import API endpoints by returning HTTP 410 Gone status.

**Files Modified:**
- `src/app/api/csv-import/upload/route.ts` → 410 Gone
- `src/app/api/csv-import/classify/route.ts` → 410 Gone
- `src/app/api/csv-import/confirm/route.ts` → 410 Gone
- `src/app/api/csv-import/parse/route.ts` → 410 Gone
- `src/app/api/ai-import/upload/route.ts` → 410 Gone
- `src/app/api/ai-import/parse/route.ts` → 410 Gone

**Preserved Routes (Still Active):**
- `src/app/api/ai-import/cleanup` — Infrastructure; used by admin cleanup tasks
- `src/app/api/ai-import/image/[id]` — Image serving; still referenced by legacy sessions

**Migration Path:** All clients should migrate to `/api/transactions/{csv,ai}/*` endpoints.

---

## Post-Build Shared Component Fixes

After the Phase C cleanup and initial build, a **5-error Turbopack build failure** was discovered due to broken imports from deleted directories. The following fixes were applied:

| Fix | File | Change |
|-----|------|--------|
| **Shared Component Created** | `src/components/ImportAuditIcon.tsx` | NEW: Extracted shared audit icon component |
| **Bank Import Updated** | `src/app/(authorized)/cashflow/bank/_components/BankAssetAIImportWizard.tsx` | Updated to use transactions feature steps + `BankAIProcessingStep` |
| **Bank Import Updated** | `src/app/(authorized)/cashflow/bank/_components/BankAssetsClient.tsx` | Changed import to use `@/components/ImportAuditIcon` |
| **Expense Component Updated** | `src/app/(authorized)/cashflow/expense/_components/CategoryBreakdownModal.tsx` | Changed import to use `@/components/ImportAuditIcon` |
| **Bank-Specific Step Created** | `src/app/(authorized)/cashflow/bank/_components/BankAIProcessingStep.tsx` | NEW: Bank-specific processing step for transactions API integration |

**Key Design Decisions:**
- `ImportAuditIcon` moved to shared components (reusable across features)
- `BankAIProcessingStep` kept in bank feature (bank-specific logic; routes to transactions API)
- `BankAssetAIImportWizard` now depends on transactions feature infrastructure
- No circular dependencies; clean separation of concerns maintained

---

## Files Changed

### New Files Created

| Path | Purpose | Phase |
|------|---------|-------|
| `prisma/migrations/20250513121453_add_transaction_model/migration.sql` | Database migration for Transaction model | A1 |
| `src/server/services/transactions/_types.ts` | Service layer types for CSV confirm | A4 |
| `src/server/services/transactions/csv-confirm.service.ts` | Service to persist classified transactions | A4 |
| `src/app/api/transactions/csv/upload/route.ts` | CSV upload endpoint | A5 |
| `src/app/api/transactions/csv/classify/route.ts` | CSV classification SSE endpoint | A5 |
| `src/app/api/transactions/csv/confirm/route.ts` | CSV confirm endpoint | A5 |
| `src/app/api/transactions/ai/upload/route.ts` | AI image upload endpoint | A6 |
| `src/app/api/transactions/ai/parse/route.ts` | AI parse/extract SSE endpoint | A6 |
| `src/app/api/transactions/ai/confirm/route.ts` | AI confirm endpoint | A6 |
| `src/app/(authorized)/cashflow/transactions/layout.tsx` | Transactions page layout | A7 |
| `src/app/(authorized)/cashflow/transactions/page.tsx` | Transactions hub page | A7 |
| `src/app/(authorized)/cashflow/transactions/_components/TransactionsClient.tsx` | Transactions client component | A7 |
| `src/app/(authorized)/cashflow/transactions/_components/csv/_types.ts` | CSV wizard types | A8 |
| `src/app/(authorized)/cashflow/transactions/_components/csv/_schema.ts` | CSV wizard schemas | A8 |
| `src/app/(authorized)/cashflow/transactions/_components/csv/CSVImportWizard.tsx` | Main CSV wizard orchestrator | A8 |
| `src/app/(authorized)/cashflow/transactions/_components/csv/CSVUploadStep.tsx` | CSV upload step component | A8 |
| `src/app/(authorized)/cashflow/transactions/_components/csv/CSVClassifyingStep.tsx` | CSV classification step component | A8 |
| `src/app/(authorized)/cashflow/transactions/_components/csv/CSVResultsStep.tsx` | CSV results step component | A8 |
| `src/app/(authorized)/cashflow/transactions/_components/csv/CSVTransactionReviewTable.tsx` | CSV review UI component | A8 |
| `src/app/(authorized)/cashflow/transactions/_components/ai/_types.ts` | AI wizard types | A9 |
| `src/app/(authorized)/cashflow/transactions/_components/ai/_schema.ts` | AI wizard schemas | A9 |
| `src/app/(authorized)/cashflow/transactions/_components/ai/ConfidenceBadge.tsx` | Confidence indicator component | A9 |
| `src/app/(authorized)/cashflow/transactions/_components/ai/ImageRedactor.tsx` | PII redaction UI component | A9 |
| `src/app/(authorized)/cashflow/transactions/_components/ai/UploadStep.tsx` | AI upload step component | A9 |
| `src/app/(authorized)/cashflow/transactions/_components/ai/ProcessingStep.tsx` | AI processing step component | A9 |
| `src/app/(authorized)/cashflow/transactions/_components/ai/ReviewStep.tsx` | AI review step component (NEW) | A9 |
| `src/app/(authorized)/cashflow/transactions/_components/ai/ResultsStep.tsx` | AI results step component | A9 |
| `src/app/(authorized)/cashflow/transactions/_components/ai/AIImportWizard.tsx` | Main AI wizard orchestrator | A9 |
| `src/components/ImportAuditIcon.tsx` | Shared audit icon component | Post-Build |
| `src/app/(authorized)/cashflow/bank/_components/BankAIProcessingStep.tsx` | Bank-specific AI processing step | Post-Build |

### Modified Files

| Path | Changes | Phase |
|------|---------|-------|
| `prisma/schema.prisma` | Added `Transaction` model and enums (`TransactionTypeEnum`, `TransactionSourceEnum`, `TransactionStatusEnum`) | A1 |
| `src/server/services/ai-import/_types.ts` | Added `type: 'DEBIT' | 'CREDIT'` to `CsvTransaction`; added credit classification types | A2, A3 |
| `src/server/services/ai-import/csv-parser.service.ts` | Updated `parseCsvRow()` to classify debit/credit based on amount sign | A2 |
| `src/server/services/ai-import/csv-classifier.service.ts` | Implemented `classifyCreditTransactions()` LLM function | A3 |
| `src/__tests__/unit/csv-parser.test.ts` | Updated tests for debit/credit classification | A2 |
| `src/__tests__/unit/csv-classifier.service.test.ts` | NEW: Unit tests for credit classification | A3 |
| `src/__tests__/unit/csv-confirm.service.test.ts` | NEW: Unit tests for CSV confirm service | A4 |
| `src/layouts/SideNav.tsx` | Added "Transactions" nav item with `ArrowLeftRight` icon | B1 |
| `src/app/(authorized)/cashflow/expense/_components/ExpenseTableClient.tsx` | Removed import wizard buttons; added link to `/cashflow/transactions` | C1 |
| `src/app/(authorized)/cashflow/expense/_components/CategoryBreakdownModal.tsx` | Updated import: `./ai-import/ImportAuditIcon` → `@/components/ImportAuditIcon` | Post-Build |
| `src/app/(authorized)/cashflow/bank/_components/BankAssetsClient.tsx` | Updated import: `../expense/_components/ai-import/ImportAuditIcon` → `@/components/ImportAuditIcon` | Post-Build |
| `src/app/(authorized)/cashflow/bank/_components/BankAssetAIImportWizard.tsx` | Updated to use transactions feature steps and `BankAIProcessingStep` | Post-Build |
| `src/app/api/csv-import/upload/route.ts` | Returns 410 Gone status | D1 |
| `src/app/api/csv-import/classify/route.ts` | Returns 410 Gone status | D1 |
| `src/app/api/csv-import/confirm/route.ts` | Returns 410 Gone status | D1 |
| `src/app/api/csv-import/parse/route.ts` | Returns 410 Gone status | D1 |
| `src/app/api/ai-import/upload/route.ts` | Returns 410 Gone status | D1 |
| `src/app/api/ai-import/parse/route.ts` | Returns 410 Gone status | D1 |

### Deleted Files

| Path | Reason | Phase |
|------|--------|-------|
| `src/app/(authorized)/cashflow/expense/_components/csv-import/` | Consolidated into transactions feature | C2 |
| `src/app/(authorized)/cashflow/expense/_components/ai-import/` | Consolidated into transactions feature; **triggered shared component issue** | C2 |
| `src/__tests__/integration/csv-import-upload.integration.test.ts` | Deprecated; covered by new transaction routes | C2 |
| `src/__tests__/integration/csv-import-parse.integration.test.ts` | Deprecated; covered by new transaction routes | C2 |

---

## Lessons Learned

### 1. Co-location Boundaries Are Critical

Shared components should **never** be nested inside feature directories. Use the `src/components/` directory for anything reused across features. Co-location creates invisible dependencies that cause failures during cleanup.

### 2. Dependency Analysis Before Deletion

Before deleting large directories, perform a full codebase search for all imports from those locations. Use:
```bash
grep -r "from.*expense/_components/ai-import" src/
grep -r "from.*expense/_components/csv-import" src/
```

### 3. Preserve Backward Compatibility Where Possible

Using HTTP 410 Gone for deprecated APIs (instead of deletion) allows clients to detect and gracefully handle outdated endpoints.

### 4. Test Cross-Feature Dependencies

The bank feature's dependency on old expense components was discoverable via type checking:
```bash
pnpm run build  # Would catch these errors early
```

---

## Migration Guide

### For End Users

1. All import functionality has moved to `/cashflow/transactions`
2. No changes to import workflows; same CSV and AI-based options are available
3. Bank asset imports continue to work as before via the bank feature page

### For Developers

**Old Import Routes (Deprecated):**
```
POST /api/csv-import/upload
POST /api/csv-import/classify
POST /api/csv-import/confirm
POST /api/csv-import/parse
POST /api/ai-import/upload
POST /api/ai-import/parse
```

**New Import Routes (Active):**
```
POST /api/transactions/csv/upload
POST /api/transactions/csv/classify
POST /api/transactions/csv/confirm
POST /api/transactions/ai/upload
POST /api/transactions/ai/parse
POST /api/transactions/ai/confirm
```

All new clients should use the `/api/transactions/*` routes. The old routes return HTTP 410 Gone.

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| New Files Created | 32 |
| Files Modified | 14 |
| Files Deleted | 4 directories + 2 integration tests |
| New API Endpoints | 6 |
| Deprecated API Endpoints | 6 |
| New Database Models | 1 |
| New Enums | 3 |
| Phases | 4 |
| Post-Build Fixes | 5 |

