import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/auth', () => ({
  auth: vi.fn(async () => ({ user: { id: 'test-user' } })),
}));

vi.mock('@/server/db/client', () => ({
  prisma: {},
}));

vi.mock('@/server/services/ai-import/image-storage.adapter', () => ({
  getStorageAdapter: vi.fn(() => ({
    uploadImage: vi.fn(),
    getImageBuffer: vi.fn(),
  })),
  getStorageProviderEnum: vi.fn(() => 'LOCAL'),
}));

vi.mock('@/server/services/ai-import/cleanup.service', () => ({
  setImageExpiration: vi.fn(),
  deleteExpiredImages: vi.fn(),
}));

vi.mock('@/server/services/ai-import/ai-vision.service', () => ({
  extractExpenseData: vi.fn(),
}));

vi.mock('@/server/services/ai-import/category-matcher.service', () => ({
  matchCategoryWithEmbedding: vi.fn(),
}));

vi.mock('@/constants/ai-pricing', () => ({
  AI_MODEL_NAME: 'test-model',
  EMBEDDING_MODEL_NAME: 'test-embedding-model',
  calculateEstimatedCost: vi.fn(() => 0),
  calculateEmbeddingCost: vi.fn(() => 0),
}));

describe('AI Transactions routes exist', () => {
  it('upload route exports POST', async () => {
    const mod = await import('@/app/api/transactions/ai/upload/route');
    expect(typeof mod.POST).toBe('function');
  });

  it('parse route exports POST', async () => {
    const mod = await import('@/app/api/transactions/ai/parse/route');
    expect(typeof mod.POST).toBe('function');
  });

  it('confirm route exports POST', async () => {
    const mod = await import('@/app/api/transactions/ai/confirm/route');
    expect(typeof mod.POST).toBe('function');
  });
});
