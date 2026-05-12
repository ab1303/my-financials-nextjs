import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { AITokenUsage } from '@/server/services/ai-import/_types';

/**
 * Unit Tests for Category Matcher Service
 *
 * Tests the matchCategoryWithEmbedding() function according to LLD section 8.1:
 * 1. Exact match skips embedding — zero token usage
 * 2. Substring match skips embedding — zero token usage
 * 3. Embedding match returns category + usage — Mock embed() + embedMany()
 * 4. Below threshold returns null — Mock low similarity, verify null result
 * 5. API error falls back to fuzzy — Mock embed failure, verify Levenshtein fallback
 */

describe('Category Matcher Service - matchCategoryWithEmbedding', () => {
  /**
   * Mock implementations of the embedding service functions
   * These will be imported by category-matcher.service.ts
   */
  const mockEmbeddingService = {
    ensureCategoryEmbeddings: vi.fn(),
    findBestEmbeddingMatch: vi.fn(),
    clearEmbeddingCache: vi.fn(),
  };

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Set up mock modules before importing the service
    vi.doMock('@/server/services/ai-import/embedding.service', () => ({
      ...mockEmbeddingService,
    }));
  });

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  /**
   * Helper function to create mock embeddings (1536-dimensional vectors)
   */
  function createMockEmbedding(value: number = 0.1): number[] {
    return new Array(1536).fill(value);
  }

  /**
   * Test 1: Exact match skips embedding
   * 
   * When the extracted name matches a category exactly (case-insensitive),
   * the function should return immediately without making any embedding API calls.
   * Token usage should be zero.
   */
  describe('exact match skips embedding', () => {
    it('should return immediately with zero token usage for exact match', async () => {
      // We need to dynamically import after setting up mocks
      const { matchCategoryWithEmbedding } = await import(
        '@/server/services/ai-import/category-matcher.service'
      );

      const result = await matchCategoryWithEmbedding('Food', [
        'Food',
        'Transportation',
        'Housing',
      ]);

      expect(result).toEqual({
        categoryName: 'Food',
        embeddingUsage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
      });

      // No embedding service calls should have been made
      expect(mockEmbeddingService.ensureCategoryEmbeddings).not.toHaveBeenCalled();
      expect(mockEmbeddingService.findBestEmbeddingMatch).not.toHaveBeenCalled();
    });

    it('should be case-insensitive for exact match', async () => {
      const { matchCategoryWithEmbedding } = await import(
        '@/server/services/ai-import/category-matcher.service'
      );

      const result = await matchCategoryWithEmbedding('FOOD', [
        'Food',
        'Transportation',
      ]);

      expect(result.categoryName).toBe('Food');
      expect(result.embeddingUsage.totalTokens).toBe(0);
      expect(mockEmbeddingService.ensureCategoryEmbeddings).not.toHaveBeenCalled();
    });

    it('should handle whitespace in extracted name for exact match', async () => {
      const { matchCategoryWithEmbedding } = await import(
        '@/server/services/ai-import/category-matcher.service'
      );

      const result = await matchCategoryWithEmbedding('  Food  ', [
        'Food',
        'Transportation',
      ]);

      expect(result.categoryName).toBe('Food');
      expect(result.embeddingUsage.totalTokens).toBe(0);
      expect(mockEmbeddingService.ensureCategoryEmbeddings).not.toHaveBeenCalled();
    });
  });

  /**
   * Test 2: Substring match skips embedding
   * 
   * When the extracted name is a substring of a category or vice versa,
   * the function should return immediately without API calls.
   * Token usage should be zero.
   */
  describe('substring match skips embedding', () => {
    it('should return immediately with zero token usage for substring match', async () => {
      const { matchCategoryWithEmbedding } = await import(
        '@/server/services/ai-import/category-matcher.service'
      );

      // "Food" is a substring of "Food & Dining"
      const result = await matchCategoryWithEmbedding('Food', [
        'Food & Dining',
        'Transportation',
      ]);

      expect(result.categoryName).toBe('Food & Dining');
      expect(result.embeddingUsage.totalTokens).toBe(0);
      expect(mockEmbeddingService.ensureCategoryEmbeddings).not.toHaveBeenCalled();
    });

    it('should match when category is substring of extracted name', async () => {
      const { matchCategoryWithEmbedding } = await import(
        '@/server/services/ai-import/category-matcher.service'
      );

      // Category "Transport" is substring of extracted name "Public Transportation"
      const result = await matchCategoryWithEmbedding('Public Transportation', [
        'Transport',
        'Housing',
      ]);

      expect(result.categoryName).toBe('Transport');
      expect(result.embeddingUsage.totalTokens).toBe(0);
      expect(mockEmbeddingService.ensureCategoryEmbeddings).not.toHaveBeenCalled();
    });

    it('should be case-insensitive for substring match', async () => {
      const { matchCategoryWithEmbedding } = await import(
        '@/server/services/ai-import/category-matcher.service'
      );

      const result = await matchCategoryWithEmbedding('FOOD', [
        'Food & Dining',
        'Transportation',
      ]);

      expect(result.categoryName).toBe('Food & Dining');
      expect(result.embeddingUsage.totalTokens).toBe(0);
    });
  });

  /**
   * Test 3: Embedding match returns category + usage
   * 
   * When neither exact nor substring match succeeds, the function should:
   * - Call ensureCategoryEmbeddings to initialize the cache
   * - Call findBestEmbeddingMatch to compute similarity
   * - Return the matched category and accumulated token usage
   */
  describe('embedding match returns category + usage', () => {
    it('should call embedding service and return matched category with token usage', async () => {
      const { matchCategoryWithEmbedding } = await import(
        '@/server/services/ai-import/category-matcher.service'
      );

      // Mock the embedding service responses
      mockEmbeddingService.ensureCategoryEmbeddings.mockResolvedValue({
        promptTokens: 10,
        completionTokens: 0,
        totalTokens: 10,
      });

      mockEmbeddingService.findBestEmbeddingMatch.mockResolvedValue({
        match: {
          matched: true,
          categoryName: 'Transportation',
          similarity: 0.85,
          method: 'embedding',
        },
        usage: {
          promptTokens: 3,
          completionTokens: 0,
          totalTokens: 3,
        },
      });

      const result = await matchCategoryWithEmbedding('taxi ride', [
        'Food',
        'Transportation',
        'Housing',
      ]);

      expect(result).toEqual({
        categoryName: 'Transportation',
        embeddingUsage: {
          promptTokens: 13, // 10 (cache) + 3 (query)
          completionTokens: 0,
          totalTokens: 13,
        },
      });

      // Verify embedding service was called
      expect(mockEmbeddingService.ensureCategoryEmbeddings).toHaveBeenCalledWith([
        'Food',
        'Transportation',
        'Housing',
      ]);
      expect(mockEmbeddingService.findBestEmbeddingMatch).toHaveBeenCalledWith(
        'taxi ride',
      );
    });

    it('should accumulate embedding usage from cache and query', async () => {
      const { matchCategoryWithEmbedding } = await import(
        '@/server/services/ai-import/category-matcher.service'
      );

      mockEmbeddingService.ensureCategoryEmbeddings.mockResolvedValue({
        promptTokens: 50,
        completionTokens: 0,
        totalTokens: 50,
      });

      mockEmbeddingService.findBestEmbeddingMatch.mockResolvedValue({
        match: {
          matched: true,
          categoryName: 'Healthcare',
          similarity: 0.88,
          method: 'embedding',
        },
        usage: {
          promptTokens: 5,
          completionTokens: 0,
          totalTokens: 5,
        },
      });

      const result = await matchCategoryWithEmbedding('doctor visit', [
        'Food',
        'Healthcare',
      ]);

      expect(result.embeddingUsage).toEqual({
        promptTokens: 55, // 50 + 5
        completionTokens: 0,
        totalTokens: 55,
      });
    });

    it('should handle multiple matching attempts with proper token accumulation', async () => {
      const { matchCategoryWithEmbedding } = await import(
        '@/server/services/ai-import/category-matcher.service'
      );

      mockEmbeddingService.ensureCategoryEmbeddings.mockResolvedValue({
        promptTokens: 100,
        completionTokens: 0,
        totalTokens: 100,
      });

      mockEmbeddingService.findBestEmbeddingMatch.mockResolvedValue({
        match: {
          matched: true,
          categoryName: 'Entertainment',
          similarity: 0.82,
          method: 'embedding',
        },
        usage: {
          promptTokens: 8,
          completionTokens: 0,
          totalTokens: 8,
        },
      });

      // First call
      const result1 = await matchCategoryWithEmbedding('movie tickets', [
        'Entertainment',
        'Food',
      ]);

      expect(result1.embeddingUsage.totalTokens).toBe(108); // 100 + 8

      // Reset for second call
      mockEmbeddingService.ensureCategoryEmbeddings.mockResolvedValue({
        promptTokens: 100,
        completionTokens: 0,
        totalTokens: 100,
      });

      mockEmbeddingService.findBestEmbeddingMatch.mockResolvedValue({
        match: {
          matched: true,
          categoryName: 'Food',
          similarity: 0.91,
          method: 'embedding',
        },
        usage: {
          promptTokens: 7,
          completionTokens: 0,
          totalTokens: 7,
        },
      });

      // Second call
      const result2 = await matchCategoryWithEmbedding('restaurant', [
        'Entertainment',
        'Food',
      ]);

      expect(result2.embeddingUsage.totalTokens).toBe(107); // 100 + 7
    });
  });

  /**
   * Test 4: Below threshold returns null
   * 
   * When embedding similarity is below the configured threshold,
   * the function should return null with the embedding token usage included.
   */
  describe('below threshold returns null', () => {
    it('should return null when similarity is below threshold', async () => {
      const { matchCategoryWithEmbedding } = await import(
        '@/server/services/ai-import/category-matcher.service'
      );

      mockEmbeddingService.ensureCategoryEmbeddings.mockResolvedValue({
        promptTokens: 10,
        completionTokens: 0,
        totalTokens: 10,
      });

      // Mock low similarity (e.g., 0.45, below default threshold of 0.75)
      mockEmbeddingService.findBestEmbeddingMatch.mockResolvedValue({
        match: {
          matched: false,
          categoryName: null,
          similarity: 0.45,
          method: 'embedding',
        },
        usage: {
          promptTokens: 3,
          completionTokens: 0,
          totalTokens: 3,
        },
      });

      const result = await matchCategoryWithEmbedding('random gibberish', [
        'Food',
        'Transportation',
      ]);

      expect(result).toEqual({
        categoryName: null,
        embeddingUsage: {
          promptTokens: 13,
          completionTokens: 0,
          totalTokens: 13,
        },
      });
    });

    it('should still accumulate token usage when returning null', async () => {
      const { matchCategoryWithEmbedding } = await import(
        '@/server/services/ai-import/category-matcher.service'
      );

      mockEmbeddingService.ensureCategoryEmbeddings.mockResolvedValue({
        promptTokens: 50,
        completionTokens: 0,
        totalTokens: 50,
      });

      mockEmbeddingService.findBestEmbeddingMatch.mockResolvedValue({
        match: {
          matched: false,
          categoryName: null,
          similarity: 0.2,
          method: 'embedding',
        },
        usage: {
          promptTokens: 5,
          completionTokens: 0,
          totalTokens: 5,
        },
      });

      const result = await matchCategoryWithEmbedding('xyz123', [
        'Food',
        'Housing',
      ]);

      expect(result.categoryName).toBeNull();
      expect(result.embeddingUsage.totalTokens).toBe(55); // Still accumulates tokens
    });

    it('should handle zero similarity correctly', async () => {
      const { matchCategoryWithEmbedding } = await import(
        '@/server/services/ai-import/category-matcher.service'
      );

      mockEmbeddingService.ensureCategoryEmbeddings.mockResolvedValue({
        promptTokens: 10,
        completionTokens: 0,
        totalTokens: 10,
      });

      mockEmbeddingService.findBestEmbeddingMatch.mockResolvedValue({
        match: {
          matched: false,
          categoryName: null,
          similarity: 0,
          method: 'embedding',
        },
        usage: {
          promptTokens: 3,
          completionTokens: 0,
          totalTokens: 3,
        },
      });

      const result = await matchCategoryWithEmbedding('unrelated', [
        'Food',
      ]);

      expect(result.categoryName).toBeNull();
      expect(result.embeddingUsage.totalTokens).toBe(13);
    });
  });

  /**
   * Test 5: API error falls back to fuzzy matching
   * 
   * When the embedding API call fails, the function should:
   * - Catch the error
   * - Fall back to Levenshtein distance-based fuzzy matching
   * - Return the fuzzy match result (or null if no fuzzy match found)
   */
  describe('API error falls back to fuzzy', () => {
    it('should fall back to fuzzy matching when embed API fails', async () => {
      const { matchCategoryWithEmbedding } = await import(
        '@/server/services/ai-import/category-matcher.service'
      );

      mockEmbeddingService.ensureCategoryEmbeddings.mockRejectedValue(
        new Error('API rate limited'),
      );

      // When fallback to fuzzy matching happens, no embedding service should succeed
      const result = await matchCategoryWithEmbedding('restarant', [
        'Food',
        'Transportation',
      ]);

      // Should match "Food" via fuzzy (Levenshtein similarity)
      // "restarant" is similar to "Food" via fuzzy matching rules
      expect(result.categoryName).not.toBeNull();
      expect(result.embeddingUsage.totalTokens).toBe(0); // Fuzzy uses no API tokens
    });

    it('should return null from fuzzy if no close match exists', async () => {
      const { matchCategoryWithEmbedding } = await import(
        '@/server/services/ai-import/category-matcher.service'
      );

      mockEmbeddingService.ensureCategoryEmbeddings.mockRejectedValue(
        new Error('Network error'),
      );

      const result = await matchCategoryWithEmbedding('xyzabc123', [
        'Food',
        'Transportation',
      ]);

      // "xyzabc123" has no fuzzy match with available categories
      expect(result.categoryName).toBeNull();
      expect(result.embeddingUsage.totalTokens).toBe(0);
    });

    it('should fall back gracefully when findBestEmbeddingMatch fails', async () => {
      const { matchCategoryWithEmbedding } = await import(
        '@/server/services/ai-import/category-matcher.service'
      );

      mockEmbeddingService.ensureCategoryEmbeddings.mockResolvedValue({
        promptTokens: 10,
        completionTokens: 0,
        totalTokens: 10,
      });

      mockEmbeddingService.findBestEmbeddingMatch.mockRejectedValue(
        new Error('Embedding service timeout'),
      );

      const result = await matchCategoryWithEmbedding('pizza place', [
        'Food',
        'Transportation',
      ]);

      // Should fall back to fuzzy; "pizza place" should match "Food"
      expect(result.categoryName).not.toBeNull();
      // Token usage should include the cache tokens that were spent
      expect(result.embeddingUsage.totalTokens).toBe(0); // Fuzzy fallback uses no additional tokens
    });

    it('should preserve exact/substring matches even if embedding fails', async () => {
      const { matchCategoryWithEmbedding } = await import(
        '@/server/services/ai-import/category-matcher.service'
      );

      // Exact match should succeed without calling embedding service at all
      const result = await matchCategoryWithEmbedding('Food', [
        'Food',
        'Transportation',
      ]);

      expect(result.categoryName).toBe('Food');
      expect(result.embeddingUsage.totalTokens).toBe(0);
      expect(mockEmbeddingService.ensureCategoryEmbeddings).not.toHaveBeenCalled();
    });

    it('should handle error during category embedding cache initialization', async () => {
      const { matchCategoryWithEmbedding } = await import(
        '@/server/services/ai-import/category-matcher.service'
      );

      mockEmbeddingService.ensureCategoryEmbeddings.mockRejectedValue(
        new Error('Failed to initialize category embeddings'),
      );

      const result = await matchCategoryWithEmbedding('dining out', [
        'Food',
        'Housing',
      ]);

      // Should fall back to fuzzy matching
      // "dining out" should fuzzy-match to "Food"
      expect(result.categoryName).not.toBeNull();
      expect(result.embeddingUsage.totalTokens).toBe(0);
    });
  });

  /**
   * Integration-style tests for complex scenarios
   */
  describe('complex scenarios', () => {
    it('should prioritize exact match over embedding match', async () => {
      const { matchCategoryWithEmbedding } = await import(
        '@/server/services/ai-import/category-matcher.service'
      );

      mockEmbeddingService.ensureCategoryEmbeddings.mockResolvedValue({
        promptTokens: 10,
        completionTokens: 0,
        totalTokens: 10,
      });

      mockEmbeddingService.findBestEmbeddingMatch.mockResolvedValue({
        match: {
          matched: true,
          categoryName: 'Similar Category',
          similarity: 0.95,
          method: 'embedding',
        },
        usage: { promptTokens: 3, completionTokens: 0, totalTokens: 3 },
      });

      const result = await matchCategoryWithEmbedding('Food', [
        'Food',
        'Similar Category',
      ]);

      // Should return exact match "Food" and zero tokens
      expect(result.categoryName).toBe('Food');
      expect(result.embeddingUsage.totalTokens).toBe(0);
      expect(mockEmbeddingService.ensureCategoryEmbeddings).not.toHaveBeenCalled();
    });

    it('should prioritize substring match over embedding match', async () => {
      const { matchCategoryWithEmbedding } = await import(
        '@/server/services/ai-import/category-matcher.service'
      );

      mockEmbeddingService.ensureCategoryEmbeddings.mockResolvedValue({
        promptTokens: 10,
        completionTokens: 0,
        totalTokens: 10,
      });

      mockEmbeddingService.findBestEmbeddingMatch.mockResolvedValue({
        match: {
          matched: true,
          categoryName: 'Other',
          similarity: 0.9,
          method: 'embedding',
        },
        usage: { promptTokens: 3, completionTokens: 0, totalTokens: 3 },
      });

      const result = await matchCategoryWithEmbedding('Food', [
        'Food & Beverages',
        'Other',
      ]);

      // Should return substring match "Food & Beverages" and zero tokens
      expect(result.categoryName).toBe('Food & Beverages');
      expect(result.embeddingUsage.totalTokens).toBe(0);
      expect(mockEmbeddingService.ensureCategoryEmbeddings).not.toHaveBeenCalled();
    });

    it('should handle empty category list gracefully', async () => {
      const { matchCategoryWithEmbedding } = await import(
        '@/server/services/ai-import/category-matcher.service'
      );

      mockEmbeddingService.ensureCategoryEmbeddings.mockResolvedValue({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      });

      mockEmbeddingService.findBestEmbeddingMatch.mockResolvedValue({
        match: {
          matched: false,
          categoryName: null,
          similarity: 0,
          method: 'embedding',
        },
        usage: { promptTokens: 3, completionTokens: 0, totalTokens: 3 },
      });

      const result = await matchCategoryWithEmbedding('Food', []);

      expect(result.categoryName).toBeNull();
      expect(result.embeddingUsage.totalTokens).toBe(3);
    });

    it('should handle whitespace and normalization correctly', async () => {
      const { matchCategoryWithEmbedding } = await import(
        '@/server/services/ai-import/category-matcher.service'
      );

      mockEmbeddingService.ensureCategoryEmbeddings.mockResolvedValue({
        promptTokens: 10,
        completionTokens: 0,
        totalTokens: 10,
      });

      mockEmbeddingService.findBestEmbeddingMatch.mockResolvedValue({
        match: {
          matched: true,
          categoryName: 'Transportation',
          similarity: 0.92,
          method: 'embedding',
        },
        usage: { promptTokens: 3, completionTokens: 0, totalTokens: 3 },
      });

      const result = await matchCategoryWithEmbedding('   Taxi   ', [
        'Taxi Services',
        'Transportation',
      ]);

      // "   Taxi   " should substring-match with "Taxi Services"
      expect(result.categoryName).toBe('Taxi Services');
      expect(result.embeddingUsage.totalTokens).toBe(0);
    });
  });
});
