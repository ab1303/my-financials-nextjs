import { CsvTransaction, CsvParseResult } from './_types';
import { getBankFormat } from '@/server/services/transactions/bank-format-registry';
import { parseBankCsv } from '@/server/services/transactions/csv-parser-generic.service';

/**
 * @deprecated Use parseBankCsv(content, format) from csv-parser-generic.service.ts instead.
 * This wrapper exists for backward compatibility and will be removed in a future release.
 *
 * @example
 * // Preferred usage:
 * import { parseBankCsv } from '@/server/services/transactions/csv-parser-generic.service';
 * import { getBankFormatByName } from '@/server/services/transactions/bank-format-registry';
 * const format = getBankFormatByName(account.bank.name);
 * const result = await parseBankCsv(csvContent, format);
 */
export async function parseCommBankCsv(
  csvContent: string,
): Promise<CsvParseResult> {
  const commBankFormat = getBankFormat('commbank');
  if (!commBankFormat) {
    return { success: false, error: 'CommBank format not found in registry' };
  }
  return parseBankCsv(csvContent, commBankFormat);
}

// ---------------------------------------------------------------------------
// Legacy helpers kept for any remaining callers — no longer used by new code
// ---------------------------------------------------------------------------

const REQUIRED_HEADERS = ['date', 'amount', 'description', 'balance'];

/**
 * Validate that required CSV headers are present (case-insensitive)
 */
export function validateCsvHeaders(headers: string[]): boolean {
  const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());
  return REQUIRED_HEADERS.every((required) =>
    normalizedHeaders.includes(required),
  );
}

/**
 * Parse a single CSV row into a CsvTransaction
 * Returns null if the transaction amount is zero
 * Throws error if invalid data
 */
export function parseCsvRow(
  row: Record<string, string>,
): CsvTransaction | null {
  // Get values with case-insensitive lookup and unquote
  const getField = (key: string): string => {
    const key_lower = key.toLowerCase();
    const found = Object.entries(row).find(
      ([k]) => k.toLowerCase() === key_lower,
    );
    let value = found ? found[1].trim() : '';
    // Remove surrounding quotes if present (CommBank format uses quotes for fields with special chars)
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    return value;
  };

  const amountStr = getField('amount');
  if (!amountStr) {
    throw new Error('Missing amount field');
  }

  const amountNum = parseFloat(amountStr);
  if (isNaN(amountNum)) {
    throw new Error(`Invalid amount: "${amountStr}"`);
  }

  // Skip zero amounts (neither debit nor credit)
  if (amountNum === 0) {
    return null;
  }

  // Derive transaction type from sign before making amount absolute
  const type: 'DEBIT' | 'CREDIT' = amountNum < 0 ? 'DEBIT' : 'CREDIT';
  const amount = Math.abs(amountNum);

  const dateStr = getField('date');
  if (!dateStr) {
    throw new Error('Missing date field');
  }

  // Parse date in DD/MM/YYYY format
  const parts = dateStr.split('/');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }

  const day = parseInt(parts[0]!, 10);
  const month = parseInt(parts[1]!, 10);
  const year = parseInt(parts[2]!, 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    throw new Error(`Invalid date: ${dateStr}`);
  }

  if (month < 1 || month > 12) {
    throw new Error(`Invalid month: ${month}`);
  }

  const description = getField('description') || '';
  const balanceStr = getField('balance');
  const balance =
    balanceStr && !isNaN(parseFloat(balanceStr))
      ? parseFloat(balanceStr)
      : undefined;

  return {
    date: dateStr,
    amount,
    type,
    description,
    month,
    year,
    balance,
  };
}

/**
 * Detect if a CSV line looks like a CommBank data row (starts with DD/MM/YYYY date)
 * @deprecated Internal helper kept for parseCsvRow backward compatibility.
 */
function looksLikeDataRow(line: string): boolean {
  const firstComma = line.indexOf(',');
  const dateField = firstComma > -1 ? line.slice(0, firstComma).replace(/"/g, '').trim() : '';
  return /^\d{2}\/\d{2}\/\d{4}$/.test(dateField);
}
