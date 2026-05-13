import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/auth', () => ({
  auth: vi.fn(async () => ({ user: { id: 'test-user' } })),
}));

vi.mock('@/server/db/client', () => ({
  prisma: {},
}));

vi.mock('@/server/services/ai-import/csv-parser.service', () => ({
  parseCommBankCsv: vi.fn(),
}));

vi.mock('@/server/services/ai-import/csv-classifier.service', () => ({
  classifyTransactions: vi.fn(),
  classifyCreditTransactions: vi.fn(),
}));

vi.mock('@/server/services/transactions/csv-confirm.service', () => ({
  confirmDebitTransactions: vi.fn(),
  confirmCreditTransactions: vi.fn(),
}));

describe('CSV Transactions routes exist', () => {
  it('upload route exports POST', async () => {
    const mod = await import('@/app/api/transactions/csv/upload/route');
    expect(typeof mod.POST).toBe('function');
  });

  it('classify route exports POST', async () => {
    const mod = await import('@/app/api/transactions/csv/classify/route');
    expect(typeof mod.POST).toBe('function');
  });

  it('confirm route exports POST', async () => {
    const mod = await import('@/app/api/transactions/csv/confirm/route');
    expect(typeof mod.POST).toBe('function');
  });
});
