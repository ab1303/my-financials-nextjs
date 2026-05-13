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
  // Get values with case-insensitive lookup and unquote
  const getField = (key: string): string => {
    const key_lower = key.toLowerCase();
    const found = Object.entries(row).find(([k]) => k.toLowerCase() === key_lower);
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
 * Detect if a CSV line looks like a CommBank data row (starts with DD/MM/YYYY date)
 * CommBank exports may not include a header row
 */
function looksLikeDataRow(line: string): boolean {
  const fields = parseCSVLine(line);
  return /^\d{2}\/\d{2}\/\d{4}$/.test(fields[0]?.trim() ?? '');
}

/**
 * Parse CommBank CSV content
 * Supports both formats:
 *   - With headers: Date, Amount, Description, Balance
 *   - Without headers: CommBank web export (positional columns: date, amount, description, balance)
 * Filters to debit transactions only (negative amounts in CSV become positive)
 * Normalizes amounts to positive values
 * Handles quoted fields (CommBank format uses quotes for fields with special chars)
 */
export async function parseCommBankCsv(csvContent: string): Promise<CsvParseResult> {
  if (!csvContent || !csvContent.trim()) {
    return {
      success: false,
      error: 'Empty CSV content',
    };
  }

  const lines = csvContent.trim().split('\n');
  if (lines.length < 1) {
    return {
      success: false,
      error: 'CSV must contain at least one data row',
    };
  }

  const firstLine = lines[0];
  if (!firstLine) {
    return {
      success: false,
      error: 'CSV appears to be empty',
    };
  }

  // CommBank web exports have no header row — detect by checking if first line is a data row
  let headers: string[];
  let dataStartIndex: number;

  if (looksLikeDataRow(firstLine)) {
    // Headerless format: assign positional column names
    headers = ['Date', 'Amount', 'Description', 'Balance'];
    dataStartIndex = 0;
  } else {
    // Has headers — validate them
    headers = parseCSVLine(firstLine);
    if (!validateCsvHeaders(headers)) {
      return {
        success: false,
        error: 'Missing required headers. Expected: Date, Amount, Description, Balance',
      };
    }
    dataStartIndex = 1;
  }

  const transactions: CsvTransaction[] = [];

  // Parse data rows
  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i];
    if (!line) {
      continue; // Skip empty lines
    }
    const trimmedLine = line.trim();

    const values = parseCSVLine(trimmedLine);

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

/**
 * Parse a CSV line handling quoted fields and escaped quotes
 * Handles CommBank format which uses quotes around fields containing commas or special chars
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote - add one quote and skip next
        current += '"';
        i++;
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      // Field separator (only if not inside quotes)
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add last field
  result.push(current.trim());
  return result;
}
