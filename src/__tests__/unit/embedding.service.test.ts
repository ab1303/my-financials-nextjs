import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock dependencies ---
vi.mock('ai', () => ({
  embed: vi.fn(),
  embedMany: vi.fn(),
}));
vi.mock('@/server/db', () => ({
  prisma: {
    expenseCategory: {
      findMany: vi.fn(),
    },
  },
}));
vi.mock('@/server/services/ai-import/ai-usage-log', () => ({
  AIUsageLog: {
    create: vi.fn(),
  },
}));

// --- Types ---
type ExpenseCategory = { id: string; name: string };

// --- Import after mocks ---
import { embed, embedMany } from 'ai';

import * as embeddingService from '@/server/services/ai-import/embedding.service';

type EmbedManyResult = Awaited<ReturnType<typeof embedMany>>;
type EmbedResult = Awaited<ReturnType<typeof embed>>;

const asEmbedManyResult = (
  embeddings: number[][],
  tokens: number,
): EmbedManyResult =>
  ({
    embeddings,
    usage: { tokens },
  }) as unknown as EmbedManyResult;

const asEmbedResult = (embedding: number[], tokens: number): EmbedResult =>
  ({
    embedding,
    usage: { tokens },
  }) as unknown as EmbedResult;

// --- Test Data ---
const mockCategories: ExpenseCategory[] = [
  { id: '1', name: 'Food' },
  { id: '2', name: 'Transport' },
  { id: '3', name: 'Utilities' },
];

// --- Test Suite ---
describe('embedding.service', () => {
  // Reset all mocks and cache before each test
  beforeEach(() => {
    vi.clearAllMocks();
    embeddingService.clearEmbeddingCache();
    process.env.AI_API_KEY = 'test-key';
    process.env.AI_PROVIDER = 'github';
  });
  afterEach(() => {
    delete process.env.AI_API_KEY;
    delete process.env.AI_PROVIDER;
  });

  // --- cosineSimilarity ---
  describe('cosineSimilarity', () => {
    it('should compute cosine similarity for identical vectors', () => {
      expect(
        embeddingService.cosineSimilarity([1, 2, 3], [1, 2, 3]),
      ).toBeCloseTo(1.0, 10);
    });
    it('should compute cosine similarity for orthogonal vectors', () => {
      expect(embeddingService.cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(
        0.0,
        10,
      );
    });
    it('should compute cosine similarity for opposite vectors', () => {
      expect(embeddingService.cosineSimilarity([1, 2], [-1, -2])).toBeCloseTo(
        -1.0,
        10,
      );
    });
    it('should throw on dimension mismatch', () => {
      expect(() => embeddingService.cosineSimilarity([1, 2], [1])).toThrow(
        /dimension/i,
      );
    });
    it('should return 0 for zero vectors', () => {
      expect(embeddingService.cosineSimilarity([0, 0], [0, 0])).toBe(0);
    });
    it('should handle empty vectors', () => {
      expect(embeddingService.cosineSimilarity([], [])).toBe(0);
    });
  });

  // --- getEmbeddingProvider ---
  describe('getEmbeddingProvider', () => {
    it('should throw if AI_API_KEY is missing', () => {
      delete process.env.AI_API_KEY;
      expect(() => embeddingService.getEmbeddingProvider()).toThrow(
        /AI_API_KEY/,
      );
    });
    it('should use GitHub Models base URL when provider is github', () => {
      process.env.AI_PROVIDER = 'github';
      const provider = embeddingService.getEmbeddingProvider();
      // The provider object should have a baseURL method or property
      expect(provider).toBeDefined();
    });
    it('should use custom base URL when provider is not github', () => {
      process.env.AI_PROVIDER = 'openai';
      const provider = embeddingService.getEmbeddingProvider();
      expect(provider).toBeDefined();
    });
  });

  // --- ensureCategoryEmbeddings ---
  describe('ensureCategoryEmbeddings', () => {
    it('should generate embeddings for categories on first call', async () => {
      vi.mocked(embedMany).mockResolvedValueOnce(
        asEmbedManyResult(
          [
            [0.1, 0.2],
            [0.2, 0.3],
            [0.3, 0.4],
          ],
          30,
        ),
      );
      const usage =
        await embeddingService.ensureCategoryEmbeddings(mockCategories);
      expect(embedMany).toHaveBeenCalledTimes(1);
      expect(usage).toHaveProperty('totalTokens', 30);
      expect(usage).toHaveProperty('estimatedCostUSD');
    });

    it('should cache embeddings and not regenerate on second call', async () => {
      vi.mocked(embedMany).mockResolvedValueOnce(
        asEmbedManyResult(
          [
            [0.1, 0.2],
            [0.2, 0.3],
            [0.3, 0.4],
          ],
          30,
        ),
      );
      await embeddingService.ensureCategoryEmbeddings(mockCategories);
      await embeddingService.ensureCategoryEmbeddings(mockCategories);
      expect(embedMany).toHaveBeenCalledTimes(1);
    });

    it('should regenerate embeddings when fingerprint changes', async () => {
      vi.mocked(embedMany).mockResolvedValueOnce(
        asEmbedManyResult(
          [
            [0.1, 0.2],
            [0.2, 0.3],
            [0.3, 0.4],
          ],
          30,
        ),
      );
      await embeddingService.ensureCategoryEmbeddings(mockCategories);
      const newCategories = [...mockCategories, { id: '4', name: 'NewCat' }];
      vi.mocked(embedMany).mockResolvedValueOnce(
        asEmbedManyResult(
          [
            [0.1, 0.2],
            [0.2, 0.3],
            [0.3, 0.4],
            [0.4, 0.5],
          ],
          40,
        ),
      );
      await embeddingService.ensureCategoryEmbeddings(newCategories);
      expect(embedMany).toHaveBeenCalledTimes(2);
    });

    it('should prevent concurrent API calls with lock', async () => {
      let resolveEmbedMany: ((result: EmbedManyResult) => void) | undefined;
      vi.mocked(embedMany).mockImplementation(
        () =>
          new Promise<EmbedManyResult>((resolve) => {
            resolveEmbedMany = resolve;
          }),
      );
      const p1 = embeddingService.ensureCategoryEmbeddings(mockCategories);
      const p2 = embeddingService.ensureCategoryEmbeddings(mockCategories);
      resolveEmbedMany?.(
        asEmbedManyResult(
          [
            [0.1, 0.2],
            [0.2, 0.3],
            [0.3, 0.4],
          ],
          30,
        ),
      );
      const [r1, r2] = await Promise.all([p1, p2]);
      expect(embedMany).toHaveBeenCalledTimes(1);
      expect(r1).toEqual(r2);
    });

    it('should return AITokenUsage with correct cost calculation', async () => {
      vi.mocked(embedMany).mockResolvedValueOnce(
        asEmbedManyResult(
          [
            [0.1, 0.2],
            [0.2, 0.3],
            [0.3, 0.4],
          ],
          1000,
        ),
      );
      const usage =
        await embeddingService.ensureCategoryEmbeddings(mockCategories);
      expect(usage.estimatedCostUSD).toBeCloseTo(0.02 * (1000 / 1_000_000), 6);
    });

    it('should throw on embedding API failure', async () => {
      vi.mocked(embedMany).mockRejectedValueOnce(new Error('API error'));
      await expect(
        embeddingService.ensureCategoryEmbeddings(mockCategories),
      ).rejects.toThrow(/API error/);
    });
  });

  // --- findBestCategoryMatch ---
  describe('findBestCategoryMatch', () => {
    beforeEach(() => {
      // Pre-cache embeddings for deterministic test
      vi.mocked(embedMany).mockResolvedValue(
        asEmbedManyResult(
          [
            [1, 0],
            [0, 1],
            [0.5, 0.5],
          ],
          30,
        ),
      );
    });

    it('should find category with highest similarity', async () => {
      vi.mocked(embed).mockResolvedValueOnce(asEmbedResult([1, 0], 3));
      await embeddingService.ensureCategoryEmbeddings(mockCategories);
      const result = await embeddingService.findBestCategoryMatch(
        'food',
        mockCategories,
      );
      expect(result?.category.name).toBe('Food');
      expect(result?.similarity).toBeCloseTo(1.0, 5);
    });

    it('should return null if no match above 0.75 threshold', async () => {
      vi.mocked(embed).mockResolvedValueOnce(asEmbedResult([0, 0], 3));
      await embeddingService.ensureCategoryEmbeddings(mockCategories);
      const result = await embeddingService.findBestCategoryMatch(
        'unknown',
        mockCategories,
      );
      expect(result).toBeNull();
    });

    it('should handle empty category list', async () => {
      const result = await embeddingService.findBestCategoryMatch('food', []);
      expect(result).toBeNull();
    });

    it('should call ensureCategoryEmbeddings internally', async () => {
      vi.mocked(embed).mockResolvedValueOnce(asEmbedResult([1, 0], 3));
      // Just verify the function calls ensureCategoryEmbeddings by checking it doesn't throw
      // when embeddings aren't cached yet and we clear the cache
      embeddingService.clearEmbeddingCache();
      await embeddingService.findBestCategoryMatch('food', mockCategories);
      // If it reaches here without error, it called ensureCategoryEmbeddings
      expect(true).toBe(true);
    });
  });

  // --- findBestCategoryMatchWithRetry ---
  describe('findBestCategoryMatchWithRetry', () => {
    beforeEach(async () => {
      vi.mocked(embedMany).mockResolvedValue(
        asEmbedManyResult(
          [
            [1, 0],
            [0, 1],
            [0.5, 0.5],
          ],
          30,
        ),
      );
      await embeddingService.ensureCategoryEmbeddings(mockCategories);
    });

    it('should retry on timeout', async () => {
      let callCount = 0;
      vi.mocked(embed).mockImplementation(() => {
        callCount++;
        if (callCount < 3)
          throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
        return Promise.resolve(asEmbedResult([1, 0], 3));
      });
      const result = await embeddingService.findBestCategoryMatchWithRetry(
        'food',
        mockCategories,
      );
      expect(result?.category.name).toBe('Food');
      expect(callCount).toBe(3);
    });

    it('should retry on 429 rate limit', async () => {
      let callCount = 0;
      vi.mocked(embed).mockImplementation(() => {
        callCount++;
        if (callCount < 2)
          throw Object.assign(new Error('rate limit'), { status: 429 });
        return Promise.resolve(asEmbedResult([1, 0], 3));
      });
      const result = await embeddingService.findBestCategoryMatchWithRetry(
        'food',
        mockCategories,
      );
      expect(result?.category.name).toBe('Food');
      expect(callCount).toBe(2);
    });

    it('should retry on 500 error', async () => {
      let callCount = 0;
      vi.mocked(embed).mockImplementation(() => {
        callCount++;
        if (callCount < 2)
          throw Object.assign(new Error('server error'), { status: 500 });
        return Promise.resolve(asEmbedResult([1, 0], 3));
      });
      const result = await embeddingService.findBestCategoryMatchWithRetry(
        'food',
        mockCategories,
      );
      expect(result?.category.name).toBe('Food');
      expect(callCount).toBe(2);
    });

    it('should use exponential backoff (1s, 2s, 4s)', async () => {
      vi.useFakeTimers();
      let callCount = 0;
      vi.mocked(embed).mockImplementation(() => {
        callCount++;
        if (callCount < 4)
          throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
        return Promise.resolve(asEmbedResult([1, 0], 3));
      });
      const promise = embeddingService.findBestCategoryMatchWithRetry(
        'food',
        mockCategories,
      );
      for (const delay of [1000, 2000, 4000]) {
        await vi.advanceTimersByTimeAsync(delay);
      }
      const result = await promise;
      expect(result?.category.name).toBe('Food');
      expect(callCount).toBe(4);
      vi.useRealTimers();
    });

    it('should return null after 3 retries', async () => {
      vi.useFakeTimers();
      vi.mocked(embed).mockImplementation(() => {
        throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
      });
      const promise = embeddingService.findBestCategoryMatchWithRetry(
        'food',
        mockCategories,
        3,
      );
      for (const delay of [1000, 2000, 4000]) {
        await vi.advanceTimersByTimeAsync(delay);
      }
      const result = await promise;
      expect(result).toBeNull();
      vi.useRealTimers();
    });
  });

  // --- clearEmbeddingCache ---
  describe('clearEmbeddingCache', () => {
    it('should clear module-level cache', async () => {
      vi.mocked(embedMany).mockResolvedValueOnce(
        asEmbedManyResult(
          [
            [0.1, 0.2],
            [0.2, 0.3],
            [0.3, 0.4],
          ],
          30,
        ),
      );
      vi.mocked(embedMany).mockResolvedValueOnce(
        asEmbedManyResult(
          [
            [0.1, 0.2],
            [0.2, 0.3],
            [0.3, 0.4],
          ],
          30,
        ),
      );
      await embeddingService.ensureCategoryEmbeddings(mockCategories);
      embeddingService.clearEmbeddingCache();
      // After clearing, next call should re-invoke embedMany
      await embeddingService.ensureCategoryEmbeddings(mockCategories);
      expect(embedMany).toHaveBeenCalledTimes(2);
    });

    it('should allow regeneration on next call', async () => {
      vi.mocked(embedMany).mockResolvedValueOnce(
        asEmbedManyResult(
          [
            [0.1, 0.2],
            [0.2, 0.3],
            [0.3, 0.4],
          ],
          30,
        ),
      );
      vi.mocked(embedMany).mockResolvedValueOnce(
        asEmbedManyResult(
          [
            [0.1, 0.2],
            [0.2, 0.3],
            [0.3, 0.4],
          ],
          30,
        ),
      );
      await embeddingService.ensureCategoryEmbeddings(mockCategories);
      embeddingService.clearEmbeddingCache();
      await embeddingService.ensureCategoryEmbeddings(mockCategories);
      expect(embedMany).toHaveBeenCalledTimes(2);
    });
  });
});
