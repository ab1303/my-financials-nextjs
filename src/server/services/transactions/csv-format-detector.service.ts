import type { BankCsvFormat, FormatDetectionResult } from './csv-format.types';
import {
  BANK_FORMAT_REGISTRY,
  getFullySupportedBankKeys,
} from './bank-format-registry';
import { parseCsvLine } from './csv-parser-generic.service';

/**
 * Keyword sets for each field role.
 * Used for similarity matching against actual CSV headers.
 */
const HEADER_KEYWORDS: Record<string, string[]> = {
  date: [
    'date',
    'transaction date',
    'posting date',
    'value date',
    'when posted',
  ],
  description: [
    'description',
    'narrative',
    'details',
    'memo',
    'reference',
    'transaction details',
  ],
  debit: ['debit', 'withdrawal', 'spent', 'out', 'expense', 'withdrawals'],
  credit: ['credit', 'deposit', 'income', 'in', 'received', 'deposits'],
  balance: [
    'balance',
    'available balance',
    'ending balance',
    'account balance',
    'running balance',
  ],
};

const CONFIDENCE_THRESHOLD = 0.8;

/**
 * Detect CSV format by inspecting headers and sample rows.
 *
 * Algorithm (tiered):
 *   1. For each stub format in the registry (non-fully-supported banks):
 *      a. Keyword similarity score for required column names   (weight 0.6)
 *      b. Structural validation against sample rows             (weight 0.4)
 *      c. Combined score = (keyword * 0.6) + (structure * 0.4)
 *   2. Return format with highest score ≥ CONFIDENCE_THRESHOLD (0.8)
 *   3. Return matched=false if no candidate meets threshold
 *
 * @param headers    Parsed CSV column headers (already split from header row)
 * @param sampleRows First 3–5 parsed data rows as string arrays
 */
export function detectCsvFormat(
  headers: string[],
  sampleRows: string[][],
): FormatDetectionResult {
  if (headers.length === 0) {
    return { matched: false, format: null, confidence: 0, bankKey: null };
  }

  const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());
  const fullySupportedKeys = new Set(getFullySupportedBankKeys());

  let best: {
    bankKey: string;
    format: BankCsvFormat;
    confidence: number;
  } | null = null;

  for (const [bankKey, format] of Object.entries(BANK_FORMAT_REGISTRY)) {
    // Skip fully-supported banks — they are resolved via registry name lookup, not detection
    if (fullySupportedKeys.has(bankKey)) continue;
    // Skip headerless formats — they cannot be detected from headers
    if (!format.hasHeaders) continue;

    const confidence = scoreFormat(format, normalizedHeaders, sampleRows);
    if (!best || confidence > best.confidence) {
      best = { bankKey, format, confidence };
    }
  }

  if (best && best.confidence >= CONFIDENCE_THRESHOLD) {
    return {
      matched: true,
      format: best.format,
      confidence: best.confidence,
      bankKey: best.bankKey,
    };
  }

  return {
    matched: false,
    format: null,
    confidence: best?.confidence ?? 0,
    bankKey: null,
  };
}

/**
 * Extract headers and up to 5 sample rows from raw CSV content.
 * Used by the upload route before calling detectCsvFormat().
 */
export function extractHeadersAndSamples(
  csvContent: string,
): { headers: string[]; sampleRows: string[][] } | null {
  const lines = csvContent
    .trim()
    .split('\n')
    .filter((l) => l.trim());
  if (lines.length === 0) return null;

  const headers = parseCsvLine(lines[0] ?? '');
  const sampleRows = lines.slice(1, 6).map((l) => parseCsvLine(l));

  return { headers, sampleRows };
}

// ---------------------------------------------------------------------------
// Internal scoring helpers
// ---------------------------------------------------------------------------

function scoreFormat(
  format: BankCsvFormat,
  normalizedHeaders: string[],
  sampleRows: string[][],
): number {
  const expectedColumns = getExpectedColumns(format);
  let keywordTotal = 0;
  let keywordCount = 0;

  for (const [role, colRef] of Object.entries(expectedColumns)) {
    if (typeof colRef !== 'string') continue; // numeric index — skip (headerless only)
    keywordTotal += bestHeaderScore(
      colRef.toLowerCase(),
      normalizedHeaders,
      role,
    );
    keywordCount++;
  }

  const keywordScore = keywordCount > 0 ? keywordTotal / keywordCount : 0;

  // Structure score: fraction of sample rows that have non-empty values at expected positions
  let structureScore = 1.0;
  if (sampleRows.length > 0) {
    const validRows = sampleRows.filter((row) =>
      validateSampleRow(row, format, normalizedHeaders),
    );
    structureScore = validRows.length / sampleRows.length;
  }

  return keywordScore * 0.6 + structureScore * 0.4;
}

function getExpectedColumns(
  format: BankCsvFormat,
): Record<string, string | number> {
  const cols: Record<string, string | number> = {
    date: format.columns.date,
    description: format.columns.description,
  };
  if (format.columns.balance !== undefined)
    cols.balance = format.columns.balance;
  if (format.columns.amount.kind === 'signed') {
    cols.amount = format.columns.amount.column;
  } else {
    cols.debit = format.columns.amount.debit;
    cols.credit = format.columns.amount.credit;
  }
  return cols;
}

/**
 * Score how well a given column name matches expected keywords for a field role.
 * Returns 0–1:  1.0 exact, 0.85 keyword exact, 0.65 keyword contains, 0.4 fuzzy, 0 none
 */
function bestHeaderScore(
  expected: string,
  headers: string[],
  role: string,
): number {
  const keywords = HEADER_KEYWORDS[role] ?? [expected];
  let best = 0;

  for (const header of headers) {
    // Exact match on expected column name
    if (header === expected) return 1.0;

    // Match against role keywords
    for (const kw of keywords) {
      if (header === kw) {
        best = Math.max(best, 0.85);
        continue;
      }
      if (header.includes(kw) || kw.includes(header)) {
        best = Math.max(best, 0.65);
        continue;
      }
      const sim = stringSimilarity(header, kw);
      if (sim >= 0.7) best = Math.max(best, 0.4);
    }
  }

  return best;
}

/**
 * Quick structural check: does a sample row have a plausible date in the date column
 * and a numeric value in the amount column?
 */
function validateSampleRow(
  values: string[],
  format: BankCsvFormat,
  normalizedHeaders: string[],
): boolean {
  const colIndex = (ref: string | number) =>
    typeof ref === 'number'
      ? ref
      : normalizedHeaders.indexOf(ref.toLowerCase());

  const dateIdx = colIndex(format.columns.date);
  const dateVal = values[dateIdx]?.trim() ?? '';
  if (!/\d/.test(dateVal)) return false; // must contain digits

  if (format.columns.amount.kind === 'signed') {
    const amtIdx = colIndex(format.columns.amount.column);
    const amtVal = values[amtIdx]?.trim() ?? '';
    return amtVal !== '' && !isNaN(parseFloat(amtVal));
  }

  const debitIdx = colIndex(format.columns.amount.debit);
  const creditIdx = colIndex(format.columns.amount.credit);
  const dVal = values[debitIdx]?.trim() ?? '';
  const cVal = values[creditIdx]?.trim() ?? '';
  return (
    (dVal !== '' && !isNaN(parseFloat(dVal))) ||
    (cVal !== '' && !isNaN(parseFloat(cVal)))
  );
}

/** Normalised Levenshtein similarity (0–1) */
function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const curr = [i + 1];
    for (let j = 0; j < b.length; j++) {
      curr.push(
        Math.min(
          prev[j + 1]! + 1,
          curr[j]! + 1,
          prev[j]! + (a[i] !== b[j] ? 1 : 0),
        ),
      );
    }
    prev.splice(0, prev.length, ...curr);
  }
  return prev[b.length]!;
}
