import { describe, it, expect } from 'vitest';
import { parseCommBankCsv, validateCsvHeaders, parseCsvRow } from '@/server/services/ai-import/csv-parser.service';
import { CsvTransaction } from '@/server/services/ai-import/_types';

describe('parseCommBankCsv', () => {
  const validCsv = [
    'Date,Amount,Description,Balance',
    '01/01/2024,-50.00,Groceries,950.00',
    '02/01/2024,1000.00,Salary,1950.00',
    '03/01/2024,-20.50,Coffee,929.50',
  ].join('\n');

  it('parses valid CSV and filters debits only', async () => {
    const result = await parseCommBankCsv(validCsv);
    expect(result.success).toBe(true);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions![0]).toMatchObject({
      date: '01/01/2024',
      amount: 50,
      description: 'Groceries',
      month: 1,
      year: 2024,
      balance: 950,
    });
    expect(result.transactions![1]).toMatchObject({
      date: '03/01/2024',
      amount: 20.5,
      description: 'Coffee',
      month: 1,
      year: 2024,
    });
  });

  it('extracts date, month, year correctly', async () => {
    const csv = [
      'Date,Amount,Description,Balance',
      '15/12/2023,-100.00,December,900.00',
    ].join('\n');
    const result = await parseCommBankCsv(csv);
    expect(result.success).toBe(true);
    expect(result.transactions![0]).toMatchObject({
      month: 12,
      year: 2023,
    });
  });

  it('normalizes amount to positive', async () => {
    const csv = [
      'Date,Amount,Description,Balance',
      '01/01/2024,-123.45,Test,876.55',
    ].join('\n');
    const result = await parseCommBankCsv(csv);
    expect(result.success).toBe(true);
    expect(result.transactions![0].amount).toBe(123.45);
  });

  it('validates required headers', async () => {
    const badHeaders = [
      'Date,Amount,Description',
      '01/01/2024,-50.00,Groceries',
    ].join('\n');
    const result = await parseCommBankCsv(badHeaders);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Missing required headers/);
  });

  it('errors on non-numeric amounts', async () => {
    const csv = [
      'Date,Amount,Description,Balance',
      '01/01/2024,abc,Groceries,950.00',
    ].join('\n');
    const result = await parseCommBankCsv(csv);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid amount/);
  });

  it('errors on empty CSV', async () => {
    const result = await parseCommBankCsv('');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Empty CSV/);
  });

  it('ignores extra columns', async () => {
    const csv = [
      'Date,Amount,Description,Balance,Extra,Another',
      '01/01/2024,-10.00,Test,1000,foo,bar',
    ].join('\n');
    const result = await parseCommBankCsv(csv);
    expect(result.success).toBe(true);
    expect(result.transactions![0].description).toBe('Test');
  });

  it('trims whitespace in headers and values', async () => {
    const csv = [
      ' Date , Amount , Description , Balance ',
      ' 01/01/2024 , -5.00 , Lunch , 995.00 ',
    ].join('\n');
    const result = await parseCommBankCsv(csv);
    expect(result.success).toBe(true);
    expect(result.transactions![0].description).toBe('Lunch');
    expect(result.transactions![0].amount).toBe(5);
  });

  it('returns error when no debit transactions found', async () => {
    const csv = [
      'Date,Amount,Description,Balance',
      '01/01/2024,100.00,Salary,1100.00',
      '02/01/2024,50.00,Transfer,1150.00',
    ].join('\n');
    const result = await parseCommBankCsv(csv);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/No debit transactions/);
  });

  it('handles mixed positive and negative amounts', async () => {
    const csv = [
      'Date,Amount,Description,Balance',
      '01/01/2024,-50.00,Expense,950.00',
      '02/01/2024,100.00,Income,1050.00',
      '03/01/2024,-25.00,Another,1025.00',
    ].join('\n');
    const result = await parseCommBankCsv(csv);
    expect(result.success).toBe(true);
    expect(result.transactions).toHaveLength(2);
  });

  it('handles dates in different months', async () => {
    const csv = [
      'Date,Amount,Description,Balance',
      '01/05/2024,-10.00,May,990.00',
      '01/06/2024,-20.00,June,970.00',
    ].join('\n');
    const result = await parseCommBankCsv(csv);
    expect(result.success).toBe(true);
    expect(result.transactions![0].month).toBe(5);
    expect(result.transactions![1].month).toBe(6);
  });
});

describe('validateCsvHeaders', () => {
  it('validates required headers present', () => {
    const headers = ['Date', 'Amount', 'Description', 'Balance'];
    expect(validateCsvHeaders(headers)).toBe(true);
  });

  it('validates case-insensitive headers', () => {
    const headers = ['date', 'amount', 'description', 'balance'];
    expect(validateCsvHeaders(headers)).toBe(true);
  });

  it('returns false when missing required header', () => {
    const headers = ['Date', 'Amount', 'Description'];
    expect(validateCsvHeaders(headers)).toBe(false);
  });

  it('returns true with extra headers', () => {
    const headers = ['Date', 'Amount', 'Description', 'Balance', 'Extra', 'Columns'];
    expect(validateCsvHeaders(headers)).toBe(true);
  });
});

describe('parseCsvRow', () => {
  it('parses valid debit row', () => {
    const row = {
      Date: '01/01/2024',
      Amount: '-50.00',
      Description: 'Groceries',
      Balance: '950.00',
    };
    const result = parseCsvRow(row);
    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      date: '01/01/2024',
      amount: 50,
      description: 'Groceries',
      month: 1,
      year: 2024,
    });
  });

  it('returns null for credit transaction', () => {
    const row = {
      Date: '01/01/2024',
      Amount: '100.00',
      Description: 'Salary',
      Balance: '1100.00',
    };
    expect(parseCsvRow(row)).toBeNull();
  });

  it('throws error for invalid amount', () => {
    const row = {
      Date: '01/01/2024',
      Amount: 'abc',
      Description: 'Test',
      Balance: '950.00',
    };
    expect(() => parseCsvRow(row)).toThrow(/Invalid amount/);
  });

  it('throws error for invalid date', () => {
    const row = {
      Date: 'invalid',
      Amount: '-50.00',
      Description: 'Test',
      Balance: '950.00',
    };
    expect(() => parseCsvRow(row)).toThrow(/Invalid date/);
  });
});
