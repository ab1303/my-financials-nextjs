# Generic CSV Import — Context & File Inventory

**Last Updated:** 2025  
**Status:** Ready for Phase 1 & 2 Implementation

---

## 1. Existing Files Affected

### Current Implementation (to be integrated)
| File | Purpose | Current Responsibility |
|------|---------|------------------------|
| `src/server/services/ai-import/csv-parser.service.ts` | CommBank CSV parsing | Single hardcoded format; **will deprecate** `parseCommBankCsv` |
| `src/server/services/ai-import/_types.ts` | Type definitions | Defines `CsvTransaction`, `CsvParseResult` (will extend with format detection) |
| `src/app/api/transactions/csv/upload/route.ts` | Upload endpoint | Calls `parseCommBankCsv` directly; will route to format resolver |
| `src/app/(authorized)/cashflow/transactions/_components/csv/CSVUploadStep.tsx` | UI upload form | Says "Supports CommBank CSV format"; will show format badge |
| `src/app/(authorized)/cashflow/transactions/_components/csv/_types.ts` | Wizard types | `CSVUploadStepProps`, wizard step types |
| `src/server/services/ai-import/validation.ts` | CSV validation constants | `MAX_CSV_FILE_SIZE` (5MB), `MAX_CSV_ROWS` (1000), MIME types |
| `src/__tests__/fixtures/commbank-july-2025.csv` | Test data | CommBank headerless format (111 transactions) |
| `src/__tests__/unit/csv-parser.test.ts` | Unit tests | 13 test suites for CommBank parser; will add generic parser tests |

---

## 2. New Files to Create (Phase 1 & 2)

| File | Purpose | Phase |
|------|---------|-------|
| `src/server/services/transactions/csv-format.types.ts` | Format configuration types | 1 |
| `src/server/services/transactions/bank-format-registry.ts` | CommBank + NAB format entries | 1 |
| `src/server/services/transactions/csv-parser-generic.service.ts` | Generic `parseBankCsv(content, format)` | 1 |
| `src/server/services/transactions/csv-format-detector.service.ts` | Auto-detection via headers & similarity scoring | 2 |
| `src/__tests__/fixtures/nab-sample.csv` | NAB test CSV | 1 |
| `src/__tests__/unit/csv-parser-generic.test.ts` | Generic parser + CommBank compat tests | 1 |
| `src/__tests__/unit/csv-format-detector.test.ts` | Detection algorithm tests | 2 |

---

## 3. Current Type Signatures

### `CsvTransaction` (immutable)
```typescript
export interface CsvTransaction {
  date: string;           // 'DD/MM/YYYY' (raw from CSV, not transformed)
  amount: number;         // always positive absolute value
  type: 'DEBIT' | 'CREDIT'; // derived from raw CSV amount sign
  description: string;
  month: number;          // 1-12, extracted from date string
  year: number;           // extracted from date string
  balance?: number;       // optional running balance
}
```

### `CsvParseResult` (immutable)
```typescript
export interface CsvParseResult {
  success: boolean;
  transactions?: CsvTransaction[];
  error?: string;
  message?: string;
}
```

---

## 4. Current CommBank Parser Flow

### Input
```csv
31/07/2025,"-90.72","WOOLWORTHS 1294 HORNSBY NS AUS Card xx5441 Value Date: 29/07/2025","+18811.43"
```
(NO header row; positional columns: Date, Amount, Description, Balance)

### Logic
1. **Header Detection**: First line is NOT a header (looks like DD/MM/YYYY) → treat as data row, auto-assign columns `['Date', 'Amount', 'Description', 'Balance']`
2. **Row Parsing**: Split by comma, handle quoted fields with escaped quotes
3. **Validation**: Date must match DD/MM/YYYY, amount must be numeric (non-zero), balance optional
4. **Sign Handling**: Negative amount → DEBIT; positive → CREDIT; absolute value stored
5. **Month/Year**: Parsed from date string (DD/MM/YYYY splits into month, year)

### Current Validation
- Required headers (for CSV WITH headers): `Date`, `Amount`, `Description`, `Balance`
- No max header count — extra columns ignored
- Case-insensitive header matching
- Zero amounts skipped (not included in transaction list)

---

## 5. Current Upload Route Flow

### Endpoint: `POST /api/transactions/csv/upload`

**Request:**
```http
Content-Type: multipart/form-data
formData {
  file: File (CSV)
  bankAccountId: string (UUID)
}
```

**Validation:**
1. User authenticated (NextAuth)
2. `bankAccountId` must exist in user's bank accounts
3. File MIME type: `text/csv`, `text/plain`, or `.csv` extension
4. File size ≤ 5MB
5. After parse: 1–1000 transactions

**Current Processing:**
```typescript
const parseResult = await parseCommBankCsv(csvContent);
if (!parseResult.success) {
  return 400 with error
}
const { transactions } = parseResult;
// Store in importSession.metadata, return success
```

**Response (200 OK):**
```json
{
  "fileId": "session_id",
  "fileName": "statement.csv",
  "fileSize": 12345,
  "rowCount": 50,
  "bankAccountId": "acc_xxx",
  "bankAccountName": "My Savings",
  "transactions": [
    {
      "date": "31/07/2025",
      "amount": 90.72,
      "type": "DEBIT",
      "description": "WOOLWORTHS...",
      "month": 7,
      "year": 2025,
      "balance": 18811.43
    },
    ...
  ]
}
```

---

## 6. UI Upload Step Props

```typescript
export interface CSVUploadStepProps {
  file: UploadedCSVFile | null;
  onFileSelected: (file: UploadedCSVFile) => void;
  onRemoveFile: () => void;
  onStartImport: () => void;
  isLoading?: boolean;
  bankAccounts: Array<{ id: string; name: string; bankName: string }>;
  selectedBankAccountId: string | null;
  onBankAccountChange: (id: string) => void;
}
```

**Current Behavior:**
- Shows "Supports CommBank CSV format (Date, Amount, Description, Balance)" hardcoded text
- No format badge or detection indicator
- All errors treated uniformly (red alert box)

---

## 7. Australian Banks CSV Format Survey

### Hardcoded Registry Banks (Phase 1)

| Bank | CSV Structure | Amount Type | Headers | Header Row | Row Skips | Example Format |
|------|---------------|-------------|---------|-----------|-----------|-----------------|
| **CommBank (CBA)** | 4 columns | Signed | None | Auto-detect: if first line looks like DD/MM/YYYY data → no header | 0 | `31/07/2025,-90.72,"WOOLWORTHS...",+18811.43` |
| **NAB** | 5 columns | Debit/Credit | Provided | Yes (row 1) | 0 | `Date,Narrative,Debit,Credit,Balance` |

### Placeholder Stubs (Phase 1)
| Bank | Status | Amount Type | Headers | Notes |
|------|--------|-------------|---------|-------|
| ANZ | Stub only | Signed | Yes | To be configured by user or added in Phase 2+ |
| Westpac | Stub only | Debit/Credit | Yes | To be configured by user or added in Phase 2+ |

### Out-of-Scope (Phase 3+)
- Bendigo, Macquarie, ING, St George, BOQ (future; detected via auto-detect or manual mapping)

---

## 8. Shared Service Patterns

### Location: `src/server/services/`
- **ai-import/** — Image & AI-related imports (existing; unchanged)
- **transactions/** — NEW subdirectory for CSV format + parsing (Phase 1 & 2)

### Inheritance Pattern
- `csv-parser-generic.service.ts` will **NOT** depend on `csv-parser.service.ts`
- Instead, `csv-parser.service.ts` will call `csv-parser-generic.service.ts` for backward compat
- Deprecation: add `@deprecated Use csv-parser-generic.parseBankCsv() instead` JSDoc

---

## 9. Key Decisions Ratified

| Decision | Rationale |
|----------|-----------|
| **Signed vs Split columns** | Store as union type `AmountStructure`; permits both at DB layer; easier to extend |
| **No header required? Yes** | CommBank exports sans-headers; auto-detect via date pattern `DD/MM/YYYY` in first row |
| **Registry lookup first** | Known banks use exact format; faster, deterministic, no ML needed |
| **Auto-detect fallback** | Unknown banks use keyword + cosine similarity; confidence ≥ 0.80 threshold |
| **Manual mapping (Phase 3)** | User sees column dropdowns if both registry + auto-detect fail; persisted in future DB field |
| **No transformations in parser** | Parser returns raw date strings (`DD/MM/YYYY`); caller responsible for DB storage (ISO) |
| **Transactions as wire format** | `CsvTransaction[]` stored in `importSession.metadata` until classification; not persisted as permanent DB rows until confirmed |

---

## 10. Test Fixtures & Coverage

### Existing Fixtures
- `src/__tests__/fixtures/commbank-july-2025.csv` — 111 real CommBank transactions (headerless, signed amounts)

### New Fixtures Required
- `nab-sample.csv` — 10–20 NAB transactions (headers, split debit/credit columns)

### Test Suite Organization
| File | Coverage | Suites | New/Existing |
|------|----------|--------|-------------|
| `csv-parser.test.ts` | CommBank (current) | 4 | Existing — keep unchanged |
| `csv-parser-generic.test.ts` | Generic parser + format resolution | 8–10 | **New** |
| `csv-format-detector.test.ts` | Detection algorithm, confidence scoring | 6–8 | **New** |

---

## 11. Session Metadata Schema

```typescript
// In importSession.metadata (JSON)
{
  "fileName": "statement.csv",
  "fileSize": 12345,
  "bankAccountId": "acc_xxx",
  "bankName": "CommBank",  // NEW: resolved bank name
  "detectionMethod": "registry" | "auto-detect" | null,  // NEW
  "detectedFormat": {
    "bankKey": "commbank",
    "hasHeaders": false,
    "columns": { ... },
    "dateFormat": "DD/MM/YYYY"
  },  // NEW: if auto-detected
  "transactions": [
    {
      "date": "31/07/2025",
      "amount": 90.72,
      "type": "DEBIT",
      "description": "...",
      "month": 7,
      "year": 2025,
      "balance": 18811.43
    },
    ...
  ]
}
```

---

## 12. Constants & Limits

```typescript
// Existing
export const MAX_CSV_FILE_SIZE = 5 * 1024 * 1024;  // 5 MB
export const MAX_CSV_ROWS = 1000;
export const ALLOWED_CSV_MIME_TYPES = [
  'text/csv',
  'application/csv',
  'application/octet-stream',
  'text/plain',
];

// NEW (to define in csv-format-detector.service.ts)
export const AUTO_DETECT_MIN_CONFIDENCE = 0.80;  // 80% threshold
export const AUTO_DETECT_SAMPLE_ROWS = 3;  // Inspect first 3 data rows
```

---

## 13. Glossary

| Term | Definition |
|------|-----------|
| **Bank Format** | A `BankCsvFormat` config object describing one bank's CSV export structure (column names, headers, date format, etc.) |
| **Bank Key** | Unique string identifier for a bank format (e.g., `'commbank'`, `'nab'`) |
| **Format Registry** | Singleton object mapping `bank.name` (from DB) → `BankCsvFormat`; hardcoded for Phase 1 (CommBank, NAB) |
| **Format Resolver** | Upload route function that chains: registry lookup → auto-detect → error |
| **Auto-Detect** | Algorithm in `csv-format-detector.service.ts` that inspects CSV headers & sample rows to infer format |
| **Confidence Score** | Similarity metric (0–1) indicating likelihood that auto-detected format is correct |
| **Amount Structure** | Union type `{ kind: 'signed'; column: string | number }` or `{ kind: 'split'; debit: string; credit: string }` |
| **Header Row** | First row of CSV; may contain column names (CommBank NO, NAB YES) |
| **Skip Rows** | Count of rows to skip before data rows begin (used by BOQ, others with metadata rows) |

---

## 14. File Organization Summary

```
src/
  server/
    services/
      transactions/
        ├── csv-format.types.ts          # BankCsvFormat, AmountStructure types
        ├── bank-format-registry.ts       # BANK_FORMAT_REGISTRY singleton
        ├── csv-parser-generic.service.ts # parseBankCsv(content, format)
        └── csv-format-detector.service.ts # detectCsvFormat(headers, rows)
      ai-import/
        ├── csv-parser.service.ts         # @deprecated; wraps generic parser
        └── _types.ts                      # CsvTransaction, CsvParseResult (unchanged)
  app/
    api/
      transactions/
        csv/
          upload/
            └── route.ts                   # Updated to use format resolver chain
    (authorized)/
      cashflow/
        transactions/
          _components/
            csv/
              ├── CSVUploadStep.tsx         # Updated UI: format badge, bank list
              └── _types.ts                 # Wizard types (unchanged)

spec/
  generic-csv-import/
    ├── context.md   # This file
    ├── hld.md       # Architecture & decisions
    └── lld.md       # Phase 1 & 2 detailed specs
```

---

**Next:** See `hld.md` for architecture overview, `lld.md` for implementation specs.