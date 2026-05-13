import { describe, it, expect } from 'vitest';
import { parseCommBankCsv, validateCsvHeaders, parseCsvRow } from '@/server/services/ai-import/csv-parser.service';

describe('parseCommBankCsv', () => {
  const validCsv = [
    'Date,Amount,Description,Balance',
    '01/01/2024,-50.00,Groceries,950.00',
    '02/01/2024,1000.00,Salary,1950.00',
    '03/01/2024,-20.50,Coffee,929.50',
  ].join('\n');

  it('parses valid CSV including both debits and credits', async () => {
    const result = await parseCommBankCsv(validCsv);
    expect(result.success).toBe(true);
    expect(result.transactions).toHaveLength(3);
    expect(result.transactions![0]).toMatchObject({
      date: '01/01/2024',
      amount: 50,
      type: 'DEBIT',
      description: 'Groceries',
      month: 1,
      year: 2024,
      balance: 950,
    });
    expect(result.transactions![1]).toMatchObject({
      date: '02/01/2024',
      amount: 1000,
      type: 'CREDIT',
      description: 'Salary',
      month: 1,
      year: 2024,
      balance: 1950,
    });
    expect(result.transactions![2]).toMatchObject({
      date: '03/01/2024',
      amount: 20.5,
      type: 'DEBIT',
      description: 'Coffee',
      month: 1,
      year: 2024,
      balance: 929.5,
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
      type: 'DEBIT',
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
    expect(result.transactions![0].type).toBe('DEBIT');
  });

  it('returns error when no transactions found', async () => {
    const csv = [
      'Date,Amount,Description,Balance',
      '01/01/2024,0.00,Zero,0.00',
    ].join('\n');
    const result = await parseCommBankCsv(csv);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/No transactions found/);
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
    expect(result.transactions).toHaveLength(3);
    expect(result.transactions!.map(t => t.type)).toEqual(['DEBIT', 'CREDIT', 'DEBIT']);
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
      type: 'DEBIT',
      description: 'Groceries',
      month: 1,
      year: 2024,
    });
  });

  it('returns CREDIT type for positive amount', () => {
    const row = {
      Date: '01/01/2024',
      Amount: '1000.00',
      Description: 'Salary',
      Balance: '1100.00',
    };
    const result = parseCsvRow(row);
    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      type: 'CREDIT',
      amount: 1000,
      description: 'Salary',
    });
  });

  it('returns null for zero amount', () => {
    const row = {
      Date: '01/01/2024',
      Amount: '0.00',
      Description: 'Zero',
      Balance: '0.00',
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

describe('DEBIT/CREDIT type detection', () => {
  it('sets type DEBIT for negative amounts', async () => {
    const csv = ['Date,Amount,Description,Balance', '01/01/2024,-50.00,Groceries,950.00'].join('\n');
    const result = await parseCommBankCsv(csv);
    expect(result.success).toBe(true);
    expect(result.transactions![0].type).toBe('DEBIT');
  });

  it('sets type CREDIT for positive amounts', async () => {
    const csv = ['Date,Amount,Description,Balance', '01/01/2024,1000.00,Salary Deposit,1000.00'].join('\n');
    const result = await parseCommBankCsv(csv);
    expect(result.success).toBe(true);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions![0]).toMatchObject({
      type: 'CREDIT',
      amount: 1000,
      description: 'Salary Deposit',
    });
  });

  it('parses mixed CSV with both debits and credits', async () => {
    const csv = [
      'Date,Amount,Description,Balance',
      '01/01/2024,-50.00,Groceries,950.00',
      '02/01/2024,1000.00,Salary,1950.00',
      '03/01/2024,-20.50,Coffee,929.50',
    ].join('\n');
    const result = await parseCommBankCsv(csv);
    expect(result.success).toBe(true);
    expect(result.transactions).toHaveLength(3);
    const types = result.transactions!.map(t => t.type);
    expect(types).toEqual(['DEBIT', 'CREDIT', 'DEBIT']);
  });

  it('sets amount to positive absolute value regardless of type', async () => {
    const csv = [
      'Date,Amount,Description,Balance',
      '01/01/2024,-123.45,Expense,876.55',
      '02/01/2024,500.00,Income,1376.55',
    ].join('\n');
    const result = await parseCommBankCsv(csv);
    expect(result.success).toBe(true);
    expect(result.transactions![0].amount).toBe(123.45);
    expect(result.transactions![1].amount).toBe(500.00);
  });
});
