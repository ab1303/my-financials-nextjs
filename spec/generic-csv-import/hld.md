# Generic CSV Import — High-Level Design

**Status:** Ready for Implementation  
**Phases Covered:** 1 (Backend Parser), 2 (Auto-Detection), 3–4 (Documentation Only)  
**Last Updated:** 2025

---

## 1. Problem Statement

### Current State
The CSV import wizard at `/cashflow/transactions` is **hardcoded for Commonwealth Bank (CommBank) format only**:
- Parser: `parseCommBankCsv()` in `src/server/services/ai-import/csv-parser.service.ts`
- Supported columns: `Date` (DD/MM/YYYY), `Amount` (signed), `Description`, `Balance`
- UI text: *"Supports CommBank CSV format"* — excludes all other Australian banks
- No fallback for unknown banks → 400 error with generic "validation failed"

### Impact
- Users with NAB, Westpac, ANZ, ING, etc. cannot import their bank statements
- Code is not extensible; adding a new bank requires source code changes
- No user-friendly error messaging for unsupported banks

---

## 2. Tiered Resolution Architecture

The upload route will chain three strategies (in order):

```
┌────────────────────────────────────────┐
│ Receive CSV + bankAccountId            │
└─────────────────┬──────────────────────┘
                  │
                  ▼
         ┌────────────────────────────────┐
         │ Tier 1: Registry Lookup        │
         │ bankAccount.bank.name → match? │
         └─────┬──────────────────────────┘
               │
          ┌────┴─────┬────────────────────────────┐
          │ Found     │ Not Found                  │
          ▼           ▼                            │
      [Use Format] ┌────────────────────────────┐ │
                  │ Tier 2: Auto-Detect        │ │
                  │ Inspect headers + rows     │ │
                  │ (confidence ≥ 0.80?)      │ │
                  └─────┬──────────────────────┘ │
                        │                        │
                   ┌────┴──────┬─────────────────┘
                   │ Confident │ Not confident
                   ▼           ▼
               [Use Format] ┌────────────────────────────┐
                           │ Tier 3: Manual Mapping    │
                           │ (FUTURE Phase 3)          │
                           │ → User UI interaction     │
                           └─────┬──────────────────────┘
                                 │
                            [Wait for user input]
                                 │
                            [Use Format]
                                 │
                                 ▼
                        ┌────────────────────────────┐
                        │ Parse CSV                  │
                        │ Return transactions        │
                        └────────────────────────────┘
```

---

## 3. Australian Bank CSV Format Matrix

### Existing Banks (Known Formats)

| Bank | Abbr | Amount Type | Headers | Header Row | Example Columns | Phase |
|------|------|-------------|---------|-----------|-----------------|-------|
| Commonwealth Bank | CBA | Signed | None | Auto-detect (date pattern) | Date, Amount, Description, Balance | **1** |
| National Australia Bank | NAB | Split | Yes | Row 1 | Date, Narrative, Debit, Credit, Balance | **1** |
| **Australia & New Zealand** | ANZ | Signed | Yes | Row 1 | TBD (stub) | Stub |
| **Westpac** | WBC | Split | Yes | Row 1 | TBD (stub) | Stub |
| **Bank of Queensland** | BOQ | Split | Yes | Rows 1–3 (metadata) | TBD | Stub |
| **ING** | ING | Signed or Split | Yes | Row 1 | TBD | Stub |
| **St George** | STG | Split | Yes | Row 1 | TBD | Stub |
| **Bendigo Bank** | BEN | Signed | Yes | Row 1 | TBD | Stub |
| **Macquarie Bank** | MQG | Signed | Yes | Row 1 | TBD | Stub |

### Legend
- **Amount Type**: `Signed` = single column, negative=debit, positive=credit; `Split` = separate Debit & Credit columns
- **Headers**: `Yes` = CSV includes header row; `None` = positional columns only (CommBank)
- **Header Row**: Row number of first header (usually 1, sometimes metadata rows skip to row 3+)
- **Phase**: When bank support is implemented (1 = POC, Stub = placeholder config, Phase 2+ = added later)

---

## 4. Key Design Decisions

| # | Decision | Rationale | Alternatives Considered |
|---|----------|-----------|-------------------------|
| 1 | **Union type for amount** (signed OR split columns) | Single format config handles both structural patterns; no duplicate definitions | Separate `SignedFormatConfig` + `SplitFormatConfig` classes (more verbose) |
| 2 | **Registry-first resolution** | Fast, deterministic, no guessing; perfect for banks with fixed formats | Always auto-detect (slower, might match wrong bank) |
| 3 | **Auto-detect as fallback** | Unknown bank names bypass registry; algorithm inspects headers for keywords + cosine similarity | LLM-based detection (overkill, expensive, slow) |
| 4 | **0.80 confidence threshold** | 80% similarity = high confidence; balances false positives vs. false negatives | 0.70 (too loose), 0.95 (too strict) |
| 5 | **Raw date strings in `CsvTransaction`** | Parser doesn't transform; caller (classifier) handles conversion to ISO | Store ISO dates (violates single responsibility; parser becomes tightly coupled to DB schema) |
| 6 | **No header required (CommBank)** | Matches real CommBank web export format; auto-detect via regex on first row | Require headers everywhere (breaks CommBank compatibility) |
| 7 | **Signed vs. type derivation** | Negative raw amount → DEBIT; positive → CREDIT; store absolute value | Use raw signed amount; caller determines direction (confusing API) |
| 8 | **Format config in code (no DB)** | Phase 1: hardcoded registry; fast, no DB queries, version-controlled | Phase 2+: extensible DB-driven config (added later if needed) |

---

## 5. Data Flow Diagram — Upload Route

```
┌──────────────────────────────────────────────────────────┐
│ POST /api/transactions/csv/upload                        │
│ { file: File; bankAccountId: string }                   │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ├─ Validate: user authenticated
                 ├─ Validate: bankAccountId exists + owned by user
                 ├─ Validate: file MIME type ∈ [text/csv, ...]
                 ├─ Validate: file size ≤ 5MB
                 │
                 ▼
        ┌────────────────────────────────────┐
        │ Get bank.name from bankAccount     │
        │ (e.g., "Commonwealth Bank")        │
        └────────┬───────────────────────────┘
                 │
                 ▼
        ┌────────────────────────────────────┐
        │ Resolve format:                    │
        │ (1) Registry lookup                │
        │ (2) If not found:                  │
        │     auto-detect (confidence ≥0.80)│
        │ (3) If both fail: 400 error        │
        └────────┬───────────────────────────┘
                 │
                 ▼
        ┌────────────────────────────────────┐
        │ parseBankCsv(csvContent, format)   │
        │ Returns: CsvParseResult            │
        │ - success: boolean                 │
        │ - transactions?: CsvTransaction[]  │
        │ - error?: string                   │
        │ - detectionMethod?: string         │
        └────────┬───────────────────────────┘
                 │
        ┌────────┴──────────────────┐
        │                           │
    Success                      Failure
        │                           │
        ▼                           ▼
   ┌────────────────┐      ┌────────────────┐
   │ 200 OK:        │      │ 400 Bad Request│
   │ {              │      │ {              │
   │  fileId,       │      │  error:        │
   │  transactions, │      │  "Bank format  │
   │  rowCount,     │      │   not          │
   │  detMethod     │      │   supported"   │
   │ }              │      │ }              │
   └────────────────┘      └────────────────┘
        │
        ▼
   Store in importSession.metadata
   (transactions NOT yet persisted to DB)
   Ready for classification step
```

---

## 6. Response Structure (Phase 2)

### Upload Response (includes detection info)

```json
{
  "fileId": "import_session_id",
  "fileName": "statement.csv",
  "fileSize": 98765,
  "rowCount": 50,
  "bankAccountId": "acc_xxx",
  "bankAccountName": "My Savings",
  "bankName": "Commonwealth Bank",
  "detectionMethod": "registry",
  "detectedFormat": null,
  "transactions": [
    {
      "date": "31/07/2025",
      "amount": 90.72,
      "type": "DEBIT",
      "description": "WOOLWORTHS 1294 HORNSBY",
      "month": 7,
      "year": 2025,
      "balance": 18811.43
    }
  ]
}
```

**Fields:**
- `detectionMethod`: `"registry"` (Tier 1), `"auto-detect"` (Tier 2), or `null` (manual mapping, Phase 3)
- `detectedFormat`: `null` if registry hit; includes full format config if auto-detected
- `bankName`: Resolved bank name from registry or auto-detect result

---

## 7. Format Configuration Schema

```typescript
// Defined in csv-format.types.ts

export type AmountStructure =
  | { kind: 'signed'; column: string | number }
  | { kind: 'split'; debit: string; credit: string };

export interface BankCsvFormat {
  bankKey: string;  // unique identifier (e.g., 'commbank', 'nab')
  hasHeaders: boolean;
  skipLeadingRows?: number;  // rows to skip before data (BOQ example: 3)
  columns: {
    date: string | number;        // column name or index
    description: string | number;
    balance?: string | number;
    amount: AmountStructure;  // union type
  };
  dateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY';
}
```

### Example Configs

**CommBank (Tier 1):**
```typescript
{
  bankKey: 'commbank',
  hasHeaders: false,
  columns: {
    date: 0,
    amount: { kind: 'signed', column: 1 },
    description: 2,
    balance: 3,
  },
  dateFormat: 'DD/MM/YYYY',
}
```

**NAB (Tier 1):**
```typescript
{
  bankKey: 'nab',
  hasHeaders: true,
  columns: {
    date: 'Date',
    description: 'Narrative',
    amount: { kind: 'split', debit: 'Debit', credit: 'Credit' },
    balance: 'Balance',
  },
  dateFormat: 'DD/MM/YYYY',
}
```

**ANZ (Stub — to be configured):**
```typescript
{
  bankKey: 'anz',
  hasHeaders: true,
  columns: {
    date: 'Transaction Date',
    description: 'Description',
    amount: { kind: 'signed', column: 'Amount' },
    balance: undefined,
  },
  dateFormat: 'DD/MM/YYYY',
}
```

---

## 8. Auto-Detection Algorithm (Phase 2)

### Input
- CSV headers (first row, or detected headers)
- Sample data rows (first 3 non-empty rows after headers)

### Process
```
1. Extract headers from CSV
2. For each bank in STUB_FORMATS (ANZ, Westpac, ...):
     a. Calculate keyword similarity score
        - Date column: look for keywords ["Date", "Transaction Date", "Value Date"]
        - Description: ["Description", "Narrative", "Details"]
        - Debit/Credit: ["Debit", "Withdrawal"], ["Credit", "Deposit"]
     b. Calculate cosine similarity between CSV structure and expected structure
     c. Sum scores: (keyword_match * 0.7) + (column_structure_match * 0.3)
3. Return highest-scoring format if score ≥ 0.80
4. If no format ≥ 0.80: return null (no confident match)
```

### Similarity Scoring
- **Exact match**: 1.0
- **Substring match**: 0.8 (e.g., "Debit" in "Withdrawal Debit")
- **Fuzzy match**: 0.6 (edit distance ≤ 2)
- **No match**: 0.0

### Confidence Calculation
```
confidence = (keyword_matches / total_expected_keywords) * 0.7 + 
             (structure_match_score) * 0.3

Threshold: ≥ 0.80 → accept, < 0.80 → reject
```

---

## 9. Out of Scope (Phases 3 & 4, Not in Implementation)

### Phase 3 — Column Mapping UI (Good-to-Have)
- [ ] New wizard step: `CSVColumnMappingStep` (interactive dropdowns)
- [ ] Visual column-role selector over CSV preview
- [ ] Persist user mapping → future `BankAccount.csvFormatOverride` DB field
- [ ] Use override format on subsequent imports

### Phase 4 — Error UX (Good-to-Have)
- [ ] Better 400 error messages:
  - "This bank format is not yet supported. Try mapping columns manually [Learn More]"
  - "Uploaded CSV doesn't match any known bank format. Supported banks: CommBank, NAB, ANZ..."
- [ ] Link to help docs with supported bank list

### Phase 5+ (Not Discussed)
- [ ] LLM-based format detection (expensive, slow)
- [ ] OFX/QIF format support (ISO standard, not AU-specific)
- [ ] International bank formats
- [ ] Database-driven format registry (versioning, rollback)
- [ ] User-submitted format definitions (crowdsourced)

---

## 10. Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **CommBank & NAB parsing** | 100% pass | Unit tests; production smoke tests |
| **Auto-detect accuracy** | ≥ 95% | Test with 5–10 sample CSVs per stub bank |
| **Error messages clarity** | Qualitative | User feedback; no "validation failed" generics |
| **Backward compatibility** | 100% pass | Existing CommBank imports still work (deprecation wrapper) |
| **No regression** | ≥ 95% pass | All existing `csv-parser.test.ts` suites pass |

---

## 11. Implementation Sequence

### Phase 1: Generic Parser + CommBank/NAB
1. ✅ Define `BankCsvFormat` types in `csv-format.types.ts`
2. ✅ Implement `parseBankCsv(content, format)` in `csv-parser-generic.service.ts`
3. ✅ Create `BANK_FORMAT_REGISTRY` with CommBank + NAB entries
4. ✅ Update upload route to use registry + fallback to auto-detect
5. ✅ Deprecate `parseCommBankCsv` (thin wrapper)
6. ✅ Add unit tests (generic parser + registry)
7. ✅ Update UI: show format badge, bank list

### Phase 2: Auto-Detection
8. ✅ Implement `detectCsvFormat()` in `csv-format-detector.service.ts`
9. ✅ Upload route chains: registry → auto-detect (confidence ≥ 0.80) → error
10. ✅ Add unit tests (detection algorithm)
11. ✅ Add ANZ + Westpac as stub entries in registry

### Phase 3 & 4: Documented Only (Not in Scope)
12. 📋 Column mapping UI (future)
13. 📋 Enhanced error UX (future)

---

## 12. Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Backward compatibility break** | High | Keep `parseCommBankCsv` as thin `@deprecated` wrapper; all existing tests pass |
| **False positive auto-detect** | Medium | Set threshold to 0.80 (high confidence); fallback to error, not guess |
| **New bank added without registry** | Medium | Upload route returns clear error: "Bank format not supported"; link to Phase 3 UI |
| **Date format ambiguity** | Low | Store raw date string in `CsvTransaction`; classifier handles conversion; no transformation in parser |
| **Large CSV file timeout** | Low | Existing 5MB + 1000-row limits apply; parser is O(n) single-pass |

---

## 13. Testing Strategy

### Unit Tests (to implement)

**Generic Parser (`csv-parser-generic.test.ts`):**
- Parse CommBank format (backward compat with existing `parseCommBankCsv` output)
- Parse NAB format (headers, split debit/credit)
- Handle headerless vs. header-full formats
- Date parsing: DD/MM/YYYY, YYYY-MM-DD, MM/DD/YYYY
- Amount parsing: signed column, split columns
- Skip leading rows (BOQ use case)
- Error cases: missing columns, invalid dates, zero amounts

**Format Detector (`csv-format-detector.test.ts`):**
- Detect CommBank (should pass; known format)
- Detect NAB (should pass; known format)
- Detect ANZ (stub; low confidence expected)
- Return `null` for completely unknown formats
- Return highest-confidence match when multiple ≥ 0.80
- Confidence score calculation (keyword + structure)

### Integration Tests
- End-to-end upload route with CommBank CSV → success
- End-to-end upload route with NAB CSV → success
- Upload unknown bank → 400 with friendly message

### Smoke Tests (Production)
- 5 sample CSVs per supported bank
- No regressions in existing CommBank imports

---

## 14. Glossary

| Term | Definition |
|------|-----------|
| **Bank Key** | Unique string identifier for a format (e.g., `'commbank'`, `'nab'`) |
| **Amount Structure** | Union type for single-signed or split debit/credit column layout |
| **Format Registry** | Singleton mapping bank names → `BankCsvFormat` configs |
| **Tier 1–3 Resolution** | Fallback chain: registry → auto-detect → manual mapping (Phase 3) |
| **Confidence Score** | 0–1 metric from auto-detect algorithm; ≥ 0.80 accepted |
| **Detection Method** | Indicates which resolver succeeded: `'registry'`, `'auto-detect'`, or `'manual'` (Phase 3) |
| **Skip Rows** | Leading rows to skip before data (e.g., BOQ has 3-row header) |
| **Headerless CSV** | CommBank format: no header row; columns inferred positionally |

---

**Next:** See `lld.md` for detailed Phase 1 & 2 implementation specs.