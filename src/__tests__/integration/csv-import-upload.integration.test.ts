import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { POST } from '@/app/api/csv-import/upload/route';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { NextRequest } from 'next/server';

// Mock auth and prisma
vi.mock('@/server/auth');
vi.mock('@/server/db');

describe('POST /api/csv-import/upload', () => {
  const mockSession = {
    user: { id: 'test-user-123', email: 'test@example.com' },
  };

  const validCsvContent = [
    'Date,Amount,Description,Balance',
    '01/01/2024,-50.00,Groceries,950.00',
    '02/01/2024,-20.50,Coffee,929.50',
  ].join('\n');

  beforeAll(() => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
  });

  afterAll(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null);

    const formData = new FormData();
    const blob = new Blob([validCsvContent], { type: 'text/csv' });
    formData.append('files', blob, 'test.csv');

    const request = new NextRequest('http://localhost:3000/api/csv-import/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 400 when no file uploaded', async () => {
    const request = new NextRequest('http://localhost:3000/api/csv-import/upload', {
      method: 'POST',
      body: new FormData(),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('returns 400 for invalid MIME type', async () => {
    const formData = new FormData();
    const blob = new Blob(['not a csv'], { type: 'text/plain' });
    formData.append('files', blob, 'test.txt');

    const request = new NextRequest('http://localhost:3000/api/csv-import/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 for file size > 5MB', async () => {
    const largeContent = Buffer.alloc(5 * 1024 * 1024 + 1, 'a');
    const formData = new FormData();
    const blob = new Blob([largeContent], { type: 'text/csv' });
    formData.append('files', blob, 'large.csv');

    const request = new NextRequest('http://localhost:3000/api/csv-import/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 for missing required headers', async () => {
    const invalidCsv = [
      'Date,Amount,Description',
      '01/01/2024,-50.00,Groceries',
    ].join('\n');

    const formData = new FormData();
    const blob = new Blob([invalidCsv], { type: 'text/csv' });
    formData.append('files', blob, 'invalid.csv');

    const request = new NextRequest('http://localhost:3000/api/csv-import/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 200 with valid CSV and creates ImportSession', async () => {
    const mockSessionRecord = {
      id: 'session-123',
      userId: 'test-user-123',
      status: 'PENDING',
      fileName: 'test.csv',
      fileSize: validCsvContent.length,
      metadata: {
        transactions: [
          { date: '01/01/2024', amount: 50, description: 'Groceries', month: 1, year: 2024, balance: 950 },
          { date: '02/01/2024', amount: 20.5, description: 'Coffee', month: 1, year: 2024, balance: 929.5 },
        ],
      },
    };

    vi.mocked(prisma.importSession.create).mockResolvedValueOnce(mockSessionRecord as any);

    const formData = new FormData();
    const blob = new Blob([validCsvContent], { type: 'text/csv' });
    formData.append('files', blob, 'test.csv');

    const request = new NextRequest('http://localhost:3000/api/csv-import/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.fileId).toBe('session-123');
    expect(data.fileName).toBe('test.csv');
    expect(data.rowCount).toBe(2);
    expect(data.transactions).toHaveLength(2);
    expect(data.transactions[0]).toMatchObject({
      date: '01/01/2024',
      amount: 50,
      description: 'Groceries',
    });
  });

  it('returns 400 when no debit transactions in CSV', async () => {
    const creditOnlyCsv = [
      'Date,Amount,Description,Balance',
      '01/01/2024,100.00,Salary,1100.00',
      '02/01/2024,50.00,Transfer,1150.00',
    ].join('\n');

    const formData = new FormData();
    const blob = new Blob([creditOnlyCsv], { type: 'text/csv' });
    formData.append('files', blob, 'credits.csv');

    const request = new NextRequest('http://localhost:3000/api/csv-import/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('accepts .csv extension with application/octet-stream MIME', async () => {
    const mockSessionRecord = {
      id: 'session-456',
      userId: 'test-user-123',
      status: 'PENDING',
      fileName: 'export.csv',
      fileSize: validCsvContent.length,
      metadata: {
        transactions: [
          { date: '01/01/2024', amount: 50, description: 'Groceries', month: 1, year: 2024 },
        ],
      },
    };

    vi.mocked(prisma.importSession.create).mockResolvedValueOnce(mockSessionRecord as any);

    const formData = new FormData();
    const blob = new Blob([validCsvContent], { type: 'application/octet-stream' });
    formData.append('files', blob, 'export.csv');

    const request = new NextRequest('http://localhost:3000/api/csv-import/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
