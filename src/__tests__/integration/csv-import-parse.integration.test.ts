import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { POST } from '@/app/api/csv-import/parse/route';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { mapExpenseData } from '@/server/services/ai-import/expense-mapper.service';
import { NextRequest } from 'next/server';

// Mock auth, prisma, and mapExpenseData
vi.mock('@/server/auth');
vi.mock('@/server/db');
vi.mock('@/server/services/ai-import/map-expense-data');

describe('POST /api/csv-import/parse (SSE)', () => {
  const mockSession = {
    user: { id: 'test-user-123', email: 'test@example.com' },
  };

  const mockImportSession = {
    id: 'session-123',
    userId: 'test-user-123',
    status: 'PENDING',
    fileName: 'test.csv',
    fileSize: 500,
    metadata: {
      transactions: [
        { date: '01/05/2024', amount: 50, description: 'Groceries', month: 5, year: 2024, balance: 950 },
        { date: '02/05/2024', amount: 20.50, description: 'Coffee', month: 5, year: 2024, balance: 929.5 },
        { date: '01/06/2024', amount: 100, description: 'Gym', month: 6, year: 2024, balance: 829.5 },
      ],
    },
  };

  beforeAll(() => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
  });

  afterAll(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null);

    const request = new NextRequest('http://localhost:3000/api/csv-import/parse', {
      method: 'POST',
      body: JSON.stringify({
        fileId: 'session-123',
        importType: 'EXPENSE',
        context: { calendarId: 'cal-1' },
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 400 for invalid request body', async () => {
    const request = new NextRequest('http://localhost:3000/api/csv-import/parse', {
      method: 'POST',
      body: JSON.stringify({
        fileId: 'session-123',
        // Missing importType and context
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 404 for non-existent session', async () => {
    vi.mocked(prisma.importSession.findUnique).mockResolvedValueOnce(null);

    const request = new NextRequest('http://localhost:3000/api/csv-import/parse', {
      method: 'POST',
      body: JSON.stringify({
        fileId: 'nonexistent',
        importType: 'EXPENSE',
        context: { calendarId: 'cal-1' },
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it('returns 403 if session not owned by user', async () => {
    const otherUserSession = {
      ...mockImportSession,
      userId: 'other-user-id',
    };

    vi.mocked(prisma.importSession.findUnique).mockResolvedValueOnce(otherUserSession as any);

    const request = new NextRequest('http://localhost:3000/api/csv-import/parse', {
      method: 'POST',
      body: JSON.stringify({
        fileId: 'session-123',
        importType: 'EXPENSE',
        context: { calendarId: 'cal-1' },
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it('streams SSE events for valid session', async () => {
    vi.mocked(prisma.importSession.findUnique).mockResolvedValueOnce(mockImportSession as any);
    vi.mocked(mapExpenseData).mockResolvedValue([
      { id: 'entry-1', amount: 50, categoryId: 'cat-1' },
    ] as any);
    vi.mocked(prisma.importSession.update).mockResolvedValueOnce({ status: 'COMPLETED' } as any);
    vi.mocked(prisma.aIUsageLog.create).mockResolvedValue({ id: 'log-1' } as any);

    const request = new NextRequest('http://localhost:3000/api/csv-import/parse', {
      method: 'POST',
      body: JSON.stringify({
        fileId: 'session-123',
        importType: 'EXPENSE',
        context: { calendarId: 'cal-1' },
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    // Parse SSE events from response body
    const text = await response.text();
    expect(text).toContain('event: progress');
    expect(text).toContain('event: saved');
    expect(text).toContain('event: complete');
  });

  it('groups transactions by month and processes sequentially', async () => {
    vi.mocked(prisma.importSession.findUnique).mockResolvedValueOnce(mockImportSession as any);
    vi.mocked(mapExpenseData).mockResolvedValue([{ id: 'entry' }] as any);
    vi.mocked(prisma.importSession.update).mockResolvedValueOnce({} as any);
    vi.mocked(prisma.aIUsageLog.create).mockResolvedValue({} as any);

    const request = new NextRequest('http://localhost:3000/api/csv-import/parse', {
      method: 'POST',
      body: JSON.stringify({
        fileId: 'session-123',
        importType: 'EXPENSE',
        context: { calendarId: 'cal-1' },
      }),
    });

    const response = await POST(request);
    const text = await response.text();

    // Should process 2 months (May and June)
    const progressEvents = (text.match(/event: progress/g) || []).length;
    expect(progressEvents).toBeGreaterThanOrEqual(2);

    // Should call mapExpenseData twice (once per month)
    expect(vi.mocked(mapExpenseData)).toHaveBeenCalledTimes(2);
  });

  it('marks session as COMPLETED when all months succeed', async () => {
    vi.mocked(prisma.importSession.findUnique).mockResolvedValueOnce(mockImportSession as any);
    vi.mocked(mapExpenseData).mockResolvedValue([{ id: 'entry' }] as any);
    vi.mocked(prisma.importSession.update).mockResolvedValueOnce({} as any);
    vi.mocked(prisma.aIUsageLog.create).mockResolvedValue({} as any);

    const request = new NextRequest('http://localhost:3000/api/csv-import/parse', {
      method: 'POST',
      body: JSON.stringify({
        fileId: 'session-123',
        importType: 'EXPENSE',
        context: { calendarId: 'cal-1' },
      }),
    });

    await POST(request);

    expect(vi.mocked(prisma.importSession.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'COMPLETED',
        }),
      })
    );
  });

  it('includes correct event shape in SSE response', async () => {
    vi.mocked(prisma.importSession.findUnique).mockResolvedValueOnce(mockImportSession as any);
    vi.mocked(mapExpenseData).mockResolvedValue([{ id: 'entry-1' }, { id: 'entry-2' }] as any);
    vi.mocked(prisma.importSession.update).mockResolvedValueOnce({} as any);
    vi.mocked(prisma.aIUsageLog.create).mockResolvedValue({} as any);

    const request = new NextRequest('http://localhost:3000/api/csv-import/parse', {
      method: 'POST',
      body: JSON.stringify({
        fileId: 'session-123',
        importType: 'EXPENSE',
        context: { calendarId: 'cal-1' },
      }),
    });

    const response = await POST(request);
    const text = await response.text();

    // Check for progress event structure
    expect(text).toContain('"type":"progress"');
    expect(text).toContain('"monthsProcessed"');
    expect(text).toContain('"totalMonths"');

    // Check for saved event structure
    expect(text).toContain('"type":"saved"');
    expect(text).toContain('"recordsCreated"');
    expect(text).toContain('"month"');
    expect(text).toContain('"status":"success"');

    // Check for complete event structure
    expect(text).toContain('"type":"complete"');
    expect(text).toContain('"sessionId"');
    expect(text).toContain('"totalRecordsCreated"');
    expect(text).toContain('"overallConfidence"');
  });

  it('creates AIUsageLog entries per month', async () => {
    vi.mocked(prisma.importSession.findUnique).mockResolvedValueOnce(mockImportSession as any);
    vi.mocked(mapExpenseData).mockResolvedValue([{ id: 'entry' }] as any);
    vi.mocked(prisma.importSession.update).mockResolvedValueOnce({} as any);
    vi.mocked(prisma.aIUsageLog.create).mockResolvedValue({} as any);

    const request = new NextRequest('http://localhost:3000/api/csv-import/parse', {
      method: 'POST',
      body: JSON.stringify({
        fileId: 'session-123',
        importType: 'EXPENSE',
        context: { calendarId: 'cal-1' },
      }),
    });

    await POST(request);

    // Should create 2 usage logs (one per month)
    expect(vi.mocked(prisma.aIUsageLog.create)).toHaveBeenCalledTimes(2);
  });
});
