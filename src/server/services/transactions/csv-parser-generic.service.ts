import type {
  CsvParseResult,
  CsvTransaction,
} from '@/server/services/ai-import/_types';
import type { AmountStructure, BankCsvFormat } from './csv-format.types';

/**
 * Parse CSV content into CsvTransaction[] using a provided BankCsvFormat config.
 *
 * Replaces the CommBank-specific parseCommBankCsv(). Handles:
 *   - Headerless CSVs (e.g. CommBank web export) via positional column indices
 *   - Header-based CSVs (e.g. NAB) via case-insensitive header matching
 *   - Signed single-amount columns (negative = DEBIT)
 *   - Split debit/credit columns
 *   - skipLeadingRows for banks with metadata blocks before data
 *
 * @throws Never — all errors are returned in result.error
 */
export async function parseBankCsv(
  csvContent: string,
  format: BankCsvFormat,
): Promise<CsvParseResult> {
  if (!csvContent?.trim()) {
    return { success: false, error: 'Empty CSV content' };
  }

  const rawLines = csvContent.trim().split('\n');
  const skipRows = format.skipLeadingRows ?? 0;
  const headerLineIndex = skipRows;
  const dataStartIndex = format.hasHeaders ? skipRows + 1 : skipRows;

  if (dataStartIndex >= rawLines.length) {
    return { success: false, error: 'No data rows found in CSV' };
  }

  // Build headers array
  let headers: string[];
  if (format.hasHeaders) {
    const headerLine = rawLines[headerLineIndex];
    if (!headerLine?.trim()) {
      return { success: false, error: 'Header row is empty' };
    }
    headers = parseCsvLine(headerLine).map((h) => h.toLowerCase().trim());
  } else {
    // Headerless: generate '0', '1', '2', … as keys
    const sampleValues = parseCsvLine(rawLines[dataStartIndex] ?? '');
    headers = sampleValues.map((_, i) => String(i));
  }

  // Validate required columns exist
  const columnError = validateRequiredColumns(headers, format);
  if (columnError) return { success: false, error: columnError };

  // Parse data rows
  const transactions: CsvTransaction[] = [];

  for (let i = dataStartIndex; i < rawLines.length; i++) {
    const line = rawLines[i]?.trim();
    if (!line) continue;

    const values = parseCsvLine(line);
    const row = buildRowObject(headers, values);

    try {
      const tx = parseRow(row, format);
      if (tx) transactions.push(tx);
    } catch (err) {
      return {
        success: false,
        error: `Error parsing row ${i + 1}: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  if (transactions.length === 0) {
    return { success: false, error: 'No valid transactions found in CSV' };
  }

  return {
    success: true,
    transactions,
    message: `Successfully parsed ${transactions.length} transactions`,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function validateRequiredColumns(
  headers: string[],
  format: BankCsvFormat,
): string | null {
  const missing: string[] = [];

  const checkCol = (col: string | number, label: string) => {
    if (typeof col === 'number') {
      if (col >= headers.length) missing.push(`${label} (index ${col})`);
    } else {
      if (!headers.includes(col.toLowerCase()))
        missing.push(`${label} ('${col}')`);
    }
  };

  checkCol(format.columns.date, 'date');
  checkCol(format.columns.description, 'description');

  if (format.columns.amount.kind === 'signed') {
    checkCol(format.columns.amount.column, 'amount');
  } else {
    checkCol(format.columns.amount.debit, 'debit');
    checkCol(format.columns.amount.credit, 'credit');
  }

  return missing.length > 0
    ? `Required column(s) not found: ${missing.join(', ')}`
    : null;
}

function parseRow(
  row: Record<string, string>,
  format: BankCsvFormat,
): CsvTransaction | null {
  const dateStr = getField(row, format.columns.date).trim();
  if (!dateStr) throw new Error('Missing date field');
  if (!isValidDateFormat(dateStr, format.dateFormat)) {
    throw new Error(
      `Invalid date format: "${dateStr}" (expected ${format.dateFormat})`,
    );
  }

  const description = getField(row, format.columns.description).trim();
  const { amount, type } = extractAmount(row, format.columns.amount);

  if (amount === 0) return null; // skip zero-amount rows

  const balanceStr = format.columns.balance
    ? getField(row, format.columns.balance).trim()
    : '';
  const balance =
    balanceStr && !isNaN(parseFloat(balanceStr))
      ? parseFloat(balanceStr)
      : undefined;

  const { month, year } = parseDateComponents(dateStr, format.dateFormat);

  return { date: dateStr, amount, type, description, month, year, balance };
}

function extractAmount(
  row: Record<string, string>,
  amountStructure: AmountStructure,
): { amount: number; type: 'DEBIT' | 'CREDIT' } {
  if (amountStructure.kind === 'signed') {
    const raw = getField(row, amountStructure.column).trim();
    if (!raw) throw new Error('Missing amount field');
    const num = parseFloat(raw);
    if (isNaN(num)) throw new Error(`Invalid amount: "${raw}"`);
    return { amount: Math.abs(num), type: num < 0 ? 'DEBIT' : 'CREDIT' };
  }

  // split
  const debitRaw = getField(row, amountStructure.debit).trim();
  const creditRaw = getField(row, amountStructure.credit).trim();
  const debit = debitRaw ? parseFloat(debitRaw) : 0;
  const credit = creditRaw ? parseFloat(creditRaw) : 0;

  if (debitRaw && isNaN(debit))
    throw new Error(`Invalid debit amount: "${debitRaw}"`);
  if (creditRaw && isNaN(credit))
    throw new Error(`Invalid credit amount: "${creditRaw}"`);
  if (debit > 0 && credit > 0)
    throw new Error('Both debit and credit have values — expected only one');

  if (debit > 0) return { amount: debit, type: 'DEBIT' };
  if (credit > 0) return { amount: credit, type: 'CREDIT' };
  return { amount: 0, type: 'DEBIT' }; // both zero → will be skipped by caller
}

function getField(row: Record<string, string>, col: string | number): string {
  if (typeof col === 'number') return row[String(col)] ?? '';
  const key = Object.keys(row).find(
    (k) => k.toLowerCase() === col.toLowerCase(),
  );
  return key ? (row[key] ?? '') : '';
}

function buildRowObject(
  headers: string[],
  values: string[],
): Record<string, string> {
  const row: Record<string, string> = {};
  headers.forEach((h, i) => {
    row[h] = values[i] ?? '';
  });
  return row;
}

function isValidDateFormat(
  dateStr: string,
  format: BankCsvFormat['dateFormat'],
): boolean {
  const slashPattern = /^\d{2}\/\d{2}\/\d{4}$/;
  const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
  if (format === 'DD/MM/YYYY' || format === 'MM/DD/YYYY')
    return slashPattern.test(dateStr);
  if (format === 'YYYY-MM-DD') return isoPattern.test(dateStr);
  return false;
}

function parseDateComponents(
  dateStr: string,
  format: BankCsvFormat['dateFormat'],
): { month: number; year: number } {
  let month: number;
  let year: number;
  let day: number;

  if (format === 'DD/MM/YYYY') {
    const [d, m, y] = dateStr.split('/').map(Number);
    day = d!;
    month = m!;
    year = y!;
  } else if (format === 'MM/DD/YYYY') {
    const [m, d, y] = dateStr.split('/').map(Number);
    month = m!;
    day = d!;
    year = y!;
  } else {
    const [y, m, d] = dateStr.split('-').map(Number);
    year = y!;
    month = m!;
    day = d!;
  }

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    throw new Error(`Could not parse date components from: ${dateStr}`);
  }
  if (month < 1 || month > 12)
    throw new Error(`Invalid month ${month} in date: ${dateStr}`);
  if (day < 1 || day > 31)
    throw new Error(`Invalid day ${day} in date: ${dateStr}`);

  return { month, year };
}

/**
 * Parse a single CSV line, handling quoted fields and escaped double-quotes.
 */
export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}
