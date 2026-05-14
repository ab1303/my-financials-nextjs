/**
 * Amount structure union type.
 *
 * - `signed`: single column where negative = DEBIT, positive = CREDIT
 *   e.g. CommBank: { kind: 'signed', column: 1 }
 * - `split`: separate debit and credit columns, one empty per row
 *   e.g. NAB: { kind: 'split', debit: 'Debit', credit: 'Credit' }
 */
export type AmountStructure =
  | { kind: 'signed'; column: string | number }
  | { kind: 'split'; debit: string | number; credit: string | number };

/**
 * Bank CSV format configuration.
 * Describes the exact layout of a bank's CSV export so parseBankCsv()
 * can handle any supported bank without hard-coding column names.
 */
export interface BankCsvFormat {
  /** Unique identifier (e.g. 'commbank', 'nab') */
  bankKey: string;
  /** Does this CSV include a header row? false = CommBank headerless web export */
  hasHeaders: boolean;
  /** How many leading rows to skip before header/data starts (default: 0) */
  skipLeadingRows?: number;
  /** Column mappings — use string (header name) or number (0-based index) */
  columns: {
    date: string | number;
    description: string | number;
    balance?: string | number;
    amount: AmountStructure;
  };
  /** Date format used in this CSV */
  dateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY';
}

/**
 * Result of auto-format detection (Phase 2).
 */
export interface FormatDetectionResult {
  matched: boolean;
  format: BankCsvFormat | null;
  /** Confidence score 0–1 */
  confidence: number;
  /** Registry bank key if matched, null otherwise */
  bankKey: string | null;
}
