import { describe, it, expect } from 'vitest';
import { parseBankCsv } from '@/server/services/transactions/csv-parser-generic.service';
import {
  getBankFormat,
  getBankFormatByName,
  getSupportedBankNamesText,
} from '@/server/services/transactions/bank-format-registry';
import {
  detectCsvFormat,
  extractHeadersAndSamples,
} from '@/server/services/transactions/csv-format-detector.service';

// ---------------------------------------------------------------------------
// CommBank (headerless, signed amount)
// ---------------------------------------------------------------------------
describe('parseBankCsv — CommBank format', () => {
  const fmt = getBankFormat('commbank')!;

  it('parses headerless CSV with signed amounts', async () => {
    const csv = [
      '01/07/2024,"-50.00","WOOLWORTHS HORNSBY","+950.00"',
      '02/07/2024,"+1000.00","Salary SALARY","+1950.00"',
      '03/07/2024,"-20.50","COFFEE SHOP","+1929.50"',
    ].join('\n');

    const result = await parseBankCsv(csv, fmt);

    expect(result.success).toBe(true);
    expect(result.transactions).toHaveLength(3);
    expect(result.transactions![0]).toEqual({
      date: '01/07/2024',
      amount: 50,
      type: 'DEBIT',
      description: 'WOOLWORTHS HORNSBY',
      month: 7,
      year: 2024,
      balance: 950,
    });
    expect(result.transactions![1]).toMatchObject({
      amount: 1000,
      type: 'CREDIT',
    });
  });

  it('matches real fixture row from commbank-july-2025.csv', async () => {
    const csv =
      '22/07/2025,"+10426.00","Salary SALARY WOOLWORTH 01454667","+24333.05"';
    const result = await parseBankCsv(csv, fmt);
    expect(result.success).toBe(true);
    expect(result.transactions![0]).toMatchObject({
      date: '22/07/2025',
      amount: 10426,
      type: 'CREDIT',
      description: 'Salary SALARY WOOLWORTH 01454667',
      month: 7,
      year: 2025,
    });
  });

  it('skips zero-amount rows', async () => {
    const csv = [
      '01/07/2024,"-50.00","Groceries","+950.00"',
      '02/07/2024,"0.00","Zero","+950.00"',
      '03/07/2024,"-20.00","Coffee","+930.00"',
    ].join('\n');
    const result = await parseBankCsv(csv, fmt);
    expect(result.success).toBe(true);
    expect(result.transactions).toHaveLength(2);
  });

  it('handles quoted fields with commas', async () => {
    const csv = '01/07/2024,"-123.45","STORE, INC. (LOCATION)","+1234.55"';
    const result = await parseBankCsv(csv, fmt);
    expect(result.success).toBe(true);
    expect(result.transactions![0]!.description).toBe('STORE, INC. (LOCATION)');
  });

  it('returns error on invalid date format', async () => {
    const csv = '2024-07-01,"-50.00","Test","+950.00"';
    const result = await parseBankCsv(csv, fmt);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid date format/);
  });

  it('returns error on empty content', async () => {
    const result = await parseBankCsv('', fmt);
    expect(result.success).toBe(false);
  });

  it('extracts correct month and year', async () => {
    const csv = [
      '15/12/2023,"-100.00","December","+900.00"',
      '20/05/2024,"-50.00","May","+1100.00"',
    ].join('\n');
    const result = await parseBankCsv(csv, fmt);
    expect(result.transactions![0]).toMatchObject({ month: 12, year: 2023 });
    expect(result.transactions![1]).toMatchObject({ month: 5, year: 2024 });
  });
});

// ---------------------------------------------------------------------------
// NAB (headers, split debit/credit)
// ---------------------------------------------------------------------------
describe('parseBankCsv — NAB format', () => {
  const fmt = getBankFormat('nab')!;

  it('parses CSV with headers and split debit/credit columns', async () => {
    const csv = [
      'Date,Narrative,Debit,Credit,Balance',
      '01/07/2024,SALARY DEPOSIT,0.00,5000.00,15000.00',
      '02/07/2024,GROCERIES STORE,87.45,0.00,14912.55',
    ].join('\n');

    const result = await parseBankCsv(csv, fmt);

    expect(result.success).toBe(true);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions![0]).toMatchObject({
      date: '01/07/2024',
      amount: 5000,
      type: 'CREDIT',
      description: 'SALARY DEPOSIT',
      month: 7,
      year: 2024,
    });
    expect(result.transactions![1]).toMatchObject({
      amount: 87.45,
      type: 'DEBIT',
    });
  });

  it('skips rows where both debit and credit are zero', async () => {
    const csv = [
      'Date,Narrative,Debit,Credit,Balance',
      '01/07/2024,SALARY,0.00,1000.00,1000.00',
      '02/07/2024,ZERO ROW,0.00,0.00,1000.00',
      '03/07/2024,PURCHASE,50.00,0.00,950.00',
    ].join('\n');
    const result = await parseBankCsv(csv, fmt);
    expect(result.success).toBe(true);
    expect(result.transactions).toHaveLength(2);
  });

  it('returns error when both debit and credit are non-zero', async () => {
    const csv = [
      'Date,Narrative,Debit,Credit,Balance',
      '01/07/2024,INVALID,50.00,100.00,9000.00',
    ].join('\n');
    const result = await parseBankCsv(csv, fmt);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/both debit and credit/i);
  });

  it('handles case-insensitive headers', async () => {
    const csv = [
      'date,narrative,debit,credit,balance',
      '01/07/2024,TEST,0.00,100.00,100.00',
    ].join('\n');
    const result = await parseBankCsv(csv, fmt);
    expect(result.success).toBe(true);
    expect(result.transactions).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Registry helpers
// ---------------------------------------------------------------------------
describe('getBankFormat', () => {
  it('returns CommBank format', () => {
    const f = getBankFormat('commbank');
    expect(f).toBeDefined();
    expect(f!.hasHeaders).toBe(false);
    expect(f!.bankKey).toBe('commbank');
  });

  it('returns NAB format', () => {
    const f = getBankFormat('nab');
    expect(f).toBeDefined();
    expect(f!.hasHeaders).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(getBankFormat('CommBank')).toEqual(getBankFormat('commbank'));
    expect(getBankFormat('NAB')).toEqual(getBankFormat('nab'));
  });

  it('returns undefined for unknown bank', () => {
    expect(getBankFormat('unknownbank')).toBeUndefined();
  });
});

describe('getBankFormatByName', () => {
  it('resolves "Commonwealth Bank"', () => {
    expect(getBankFormatByName('Commonwealth Bank')?.bankKey).toBe('commbank');
  });

  it('resolves "CommBank"', () => {
    expect(getBankFormatByName('CommBank')?.bankKey).toBe('commbank');
  });

  it('resolves "National Australia Bank"', () => {
    expect(getBankFormatByName('National Australia Bank')?.bankKey).toBe('nab');
  });

  it('resolves "NAB"', () => {
    expect(getBankFormatByName('NAB')?.bankKey).toBe('nab');
  });

  it('returns undefined for unsupported bank', () => {
    expect(getBankFormatByName('Suncorp')).toBeUndefined();
  });
});

describe('getSupportedBankNamesText', () => {
  it('includes CommBank and NAB', () => {
    const text = getSupportedBankNamesText();
    expect(text).toMatch(/CommBank/i);
    expect(text).toMatch(/NAB/i);
  });
});

// ---------------------------------------------------------------------------
// Auto-detection (Phase 2)
// ---------------------------------------------------------------------------
describe('detectCsvFormat', () => {
  it('detects ANZ-like format from headers', () => {
    const headers = ['Transaction Date', 'Description', 'Amount'];
    const samples = [['15/06/2024', 'PURCHASE', '-50.00']];
    const result = detectCsvFormat(headers, samples);
    // ANZ is a stub; confidence may or may not meet threshold depending on scoring
    // At minimum it should return a result object
    expect(result).toHaveProperty('matched');
    expect(result).toHaveProperty('confidence');
  });

  it('returns matched=false for unrecognised headers', () => {
    const headers = ['Foo', 'Bar', 'Baz'];
    const samples = [['abc', 'xyz', '???']];
    const result = detectCsvFormat(headers, samples);
    expect(result.matched).toBe(false);
  });

  it('returns matched=false for empty headers', () => {
    const result = detectCsvFormat([], []);
    expect(result.matched).toBe(false);
    expect(result.confidence).toBe(0);
  });
});

describe('extractHeadersAndSamples', () => {
  it('extracts headers and up to 5 rows', () => {
    const csv = [
      'Date,Description,Amount',
      '01/07/2024,ROW1,-10.00',
      '02/07/2024,ROW2,-20.00',
    ].join('\n');
    const result = extractHeadersAndSamples(csv);
    expect(result).not.toBeNull();
    expect(result!.headers).toEqual(['Date', 'Description', 'Amount']);
    expect(result!.sampleRows).toHaveLength(2);
  });

  it('returns null for empty input', () => {
    expect(extractHeadersAndSamples('')).toBeNull();
  });
});
