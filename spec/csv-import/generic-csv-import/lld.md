# Generic CSV Parser — LLD

## Implementation Phases

### Phase 1 — Format Types + Registry
- Define `AmountStructure` union (`signed` vs `split` columns).
- Define `BankCsvFormat` contract and detection result interfaces.
- Add hardcoded registry entries (CommBank, NAB) and stubs for future banks.

### Phase 2 — Generic Parser Service
- Implement `parseBankCsv(content, format)`.
- Handle:
  - optional header rows,
  - skip-leading-row metadata,
  - quoted field parsing,
  - date validation and month/year extraction,
  - signed/split amount handling with debit/credit derivation.
- Return normalized `CsvTransaction[]` and parser errors deterministically.

### Phase 3 — Format Detection Fallback
- Implement `detectCsvFormat(headers, sampleRows)`.
- Score keyword/structure similarity and accept only above confidence threshold (default `0.80`).
- Route fallback chain: registry → auto-detect → unsupported format error.

## Interfaces

```ts
type AmountStructure =
  | { kind: 'signed'; column: string | number }
  | { kind: 'split'; debit: string | number; credit: string | number };

interface BankCsvFormat {
  bankKey: string;
  hasHeaders: boolean;
  skipLeadingRows?: number;
  columns: {
    date: string | number;
    description: string | number;
    balance?: string | number;
    amount: AmountStructure;
  };
  dateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY';
}
```

## Validation + Normalization Rules

- Reject empty CSV content.
- Verify required columns exist for selected format.
- Skip zero-amount rows.
- Produce absolute `amount` and derived `type`.
- Extract `month`/`year` from configured date format.
- Preserve raw `date` string for downstream conversion by callers.

## Acceptance Criteria

- CommBank and NAB fixtures parse into canonical `CsvTransaction`.
- Headerless and header-based files both supported.
- Detection confidence gating prevents low-confidence misclassification.
- Existing CommBank parser behavior remains backward-compatible via wrapper/deprecation path.

## File Inventory

| File | Action | Notes |
|---|---|---|
| `src/server/services/transactions/csv-format.types.ts` | CREATE | format contracts |
| `src/server/services/transactions/bank-format-registry.ts` | CREATE | known bank configs |
| `src/server/services/transactions/csv-parser-generic.service.ts` | CREATE | parser core |
| `src/server/services/transactions/csv-format-detector.service.ts` | CREATE | fallback detector |
| `src/server/services/ai-import/csv-parser.service.ts` | MODIFY | compatibility wrapper/deprecation |
| `src/app/api/transactions/csv/upload/route.ts` | MODIFY | use resolver chain |
| `src/__tests__/unit/csv-parser-generic.test.ts` | CREATE | parser coverage |
| `src/__tests__/unit/csv-format-detector.test.ts` | CREATE | detection coverage |
| `src/__tests__/fixtures/nab-sample.csv` | CREATE | fixture |
