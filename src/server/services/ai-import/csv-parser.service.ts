import { CsvTransaction, CsvParseResult } from './_types';

const REQUIRED_HEADERS = ['date', 'amount', 'description', 'balance'];

/**
 * Validate that required CSV headers are present (case-insensitive)
 */
export function validateCsvHeaders(headers: string[]): boolean {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  return REQUIRED_HEADERS.every(required =>
    normalizedHeaders.includes(required)
  );
}

/**
 * Parse a single CSV row into a CsvTransaction
 * Returns null if the transaction is a credit (positive amount)
 * Throws error if invalid data
 */
export function parseCsvRow(row: Record<string, string>): CsvTransaction | null {
  // Get values with case-insensitive lookup
  const getField = (key: string): string => {
    const key_lower = key.toLowerCase();
    const found = Object.entries(row).find(([k]) => k.toLowerCase() === key_lower);
    return found ? found[1].trim() : '';
  };

  const amountStr = getField('amount');
  if (!amountStr) {
    throw new Error('Missing amount field');
  }

  const amountNum = parseFloat(amountStr);
  if (isNaN(amountNum)) {
    throw new Error(`Invalid amount: ${amountStr}`);
  }

  // Only process debits (negative amounts)
  if (amountNum >= 0) {
    return null;
  }

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
  const balance = balanceStr && !isNaN(parseFloat(balanceStr)) ? parseFloat(balanceStr) : undefined;

  return {
    date: dateStr,
    amount: Math.abs(amountNum),
    description,
    month,
    year,
    balance,
  };
}

/**
 * Parse CommBank CSV content
 * Expects headers: Date, Amount, Description, Balance
 * Filters to debit transactions only (negative amounts in CSV become positive)
 * Normalizes amounts to positive values
 */
export async function parseCommBankCsv(csvContent: string): Promise<CsvParseResult> {
  if (!csvContent || !csvContent.trim()) {
    return {
      success: false,
      error: 'Empty CSV content',
    };
  }

  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    return {
      success: false,
      error: 'CSV must contain headers and at least one row',
    };
  }

  // Parse header line
  const headerLine = lines[0];
  if (!headerLine) {
    return {
      success: false,
      error: 'CSV must contain a header row',
    };
  }
  const headers = headerLine.split(',').map(h => h.trim());

  if (!validateCsvHeaders(headers)) {
    return {
      success: false,
      error: 'Missing required headers. Expected: Date, Amount, Description, Balance',
    };
  }

  // Create header-to-index map (case-insensitive)
  const headerMap: Record<string, number> = {};
  headers.forEach((header, index) => {
    headerMap[header.toLowerCase()] = index;
  });

  const transactions: CsvTransaction[] = [];

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) {
      continue; // Skip empty lines
    }
    const trimmedLine = line.trim();

    const values = trimmedLine.split(',').map(v => v.trim());

    // Create row object with case-insensitive keys
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    try {
      const tx = parseCsvRow(row);
      if (tx) {
        transactions.push(tx);
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Error parsing row ${i}: ${error.message}`,
      };
    }
  }

  if (transactions.length === 0) {
    return {
      success: false,
      error: 'No debit transactions found in CSV',
    };
  }

  return {
    success: true,
    transactions,
    message: `Successfully parsed ${transactions.length} debit transactions`,
  };
}
