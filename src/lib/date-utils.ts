import { format as formatDate, isValid, parse } from 'date-fns';

import type { BankCsvFormat } from '@/server/services/transactions/csv-format.types';

/**
 * Robustly parses a date string based on the provided BankCsvFormat.
 * Cleans input and validates the resulting Date object.
 */
export function robustParseDate(
  dateStr: string,
  format: BankCsvFormat['dateFormat'],
): Date {
  // Clean string: remove non-numeric and non-delimiter characters
  const cleanDateStr = dateStr.trim().replace(/[^\d/ -]/g, '');

  let parsedDate: Date;
  // Check for ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDateStr)) {
    parsedDate = parse(cleanDateStr, 'yyyy-MM-dd', new Date());
  } else {
    // Map BankCsvFormat format to date-fns format string
    const formatMap: Record<BankCsvFormat['dateFormat'], string> = {
      'DD/MM/YYYY': 'dd/MM/yyyy',
      'MM/DD/YYYY': 'MM/dd/yyyy',
      'YYYY-MM-DD': 'yyyy-MM-dd',
    };
    parsedDate = parse(cleanDateStr, formatMap[format], new Date());
  }

  if (!isValid(parsedDate)) {
    throw new Error(
      `Could not parse valid date from: "${dateStr}" using format: ${format}`,
    );
  }

  return parsedDate;
}

export function normalizeDateToISO(
  dateStr: string,
  format: BankCsvFormat['dateFormat'],
): string {
  return formatDate(robustParseDate(dateStr, format), 'yyyy-MM-dd');
}
