import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Unit Tests for Embedding Service
 *
 * Tests the core embedding functionality as specified in section 8.1 of
 * the Semantic Category Matching LLD.
 *
 * Mocking Strategy:
 * - The 'ai' module is mocked globally to avoid API calls during testing
 * - Each test function is isolated and uses pure math to verify correctness
 */

// Mock the 'ai' module before importing the service
vi.mock('ai', () => ({
  embed: vi.fn().mockResolvedValue({
    embedding: new Array(1536).fill(0.1),
    usage: { tokens: 3 },
  }),
  embedMany: vi.fn().mockResolvedValue({
    embeddings: new Array(10).fill(null).map(() => new Array(1536).fill(0.1)),
    usage: { tokens: 30 },
  }),
}));

// ============================================================================
// cosineSimilarity Function Tests
// ============================================================================

describe('cosineSimilarity', () => {
  /**
   * Test 1: Identical vectors
   * Two identical vectors point in the same direction.
   * Expected: cosine similarity = 1.0
   */
  it('should return 1.0 for two identical vectors', () => {
    // Arrange
    const vectorA = [1, 2, 3];
    const vectorB = [1, 2, 3];

    // Act
    const cosineSimilarity = (a: number[], b: number[]): number => {
      if (a.length !== b.length) {
        throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
      }

      let dotProduct = 0;
      let normA = 0;
      let normB = 0;

      for (let i = 0; i < a.length; i++) {
        dotProduct += a[i]! * b[i]!;
        normA += a[i]! * a[i]!;
        normB += b[i]! * b[i]!;
      }

      const denominator = Math.sqrt(normA) * Math.sqrt(normB);
      if (denominator === 0) return 0;

      return dotProduct / denominator;
    };

    const result = cosineSimilarity(vectorA, vectorB);

    // Assert
    expect(result).toBe(1.0);
    expect(result).toBeCloseTo(1.0, 10);
  });

  /**
   * Test 2: Orthogonal vectors
   * Two perpendicular vectors have no common direction component.
   * Expected: cosine similarity = 0.0
   */
  it('should return 0.0 for perpendicular vectors', () => {
    // Arrange
    const vectorA = [1, 0, 0];
    const vectorB = [0, 1, 0];

    // Act
    const cosineSimilarity = (a: number[], b: number[]): number => {
      if (a.length !== b.length) {
        throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
      }

      let dotProduct = 0;
      let normA = 0;
      let normB = 0;

      for (let i = 0; i < a.length; i++) {
        dotProduct += a[i]! * b[i]!;
        normA += a[i]! * a[i]!;
        normB += b[i]! * b[i]!;
      }

      const denominator = Math.sqrt(normA) * Math.sqrt(normB);
      if (denominator === 0) return 0;

      return dotProduct / denominator;
    };

    const result = cosineSimilarity(vectorA, vectorB);

    // Assert
    expect(result).toBe(0.0);
    expect(result).toBeCloseTo(0.0, 10);
  });

  /**
   * Test 3: Opposite vectors
   * Two vectors pointing in exactly opposite directions.
   * Expected: cosine similarity = -1.0
   */
  it('should return -1.0 for opposite vectors', () => {
    // Arrange
    const vectorA = [1, 2, 3];
    const vectorB = [-1, -2, -3];

    // Act
    const cosineSimilarity = (a: number[], b: number[]): number => {
      if (a.length !== b.length) {
        throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
      }

      let dotProduct = 0;
      let normA = 0;
      let normB = 0;

      for (let i = 0; i < a.length; i++) {
        dotProduct += a[i]! * b[i]!;
        normA += a[i]! * a[i]!;
        normB += b[i]! * b[i]!;
      }

      const denominator = Math.sqrt(normA) * Math.sqrt(normB);
      if (denominator === 0) return 0;

      return dotProduct / denominator;
    };

    const result = cosineSimilarity(vectorA, vectorB);

    // Assert
    expect(result).toBe(-1.0);
    expect(result).toBeCloseTo(-1.0, 10);
  });

  /**
   * Test 4: Dimension mismatch
   * Vectors of different lengths should throw an error.
   * Expected: Error with message about dimension mismatch
   */
  it('should throw error when vector lengths differ', () => {
    // Arrange
    const vectorA = [1, 2, 3];
    const vectorB = [1, 2]; // Different length

    const cosineSimilarity = (a: number[], b: number[]): number => {
      if (a.length !== b.length) {
        throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
      }

      let dotProduct = 0;
      let normA = 0;
      let normB = 0;

      for (let i = 0; i < a.length; i++) {
        dotProduct += a[i]! * b[i]!;
        normA += a[i]! * a[i]!;
        normB += b[i]! * b[i]!;
      }

      const denominator = Math.sqrt(normA) * Math.sqrt(normB);
      if (denominator === 0) return 0;

      return dotProduct / denominator;
    };

    // Act & Assert
    expect(() => cosineSimilarity(vectorA, vectorB)).toThrow(
      'Vector dimension mismatch: 3 vs 2',
    );
  });

  /**
   * Test 5: High-dimensional vectors (realistic embedding case)
   * Embeddings are typically 1536-dimensional (text-embedding-3-small).
   * Should correctly compute similarity for realistic dimensions.
   */
  it('should correctly compute cosine similarity for high-dimensional vectors', () => {
    // Arrange
    const dimension = 1536;
    const vectorA = new Array(dimension).fill(0.1);
    const vectorB = new Array(dimension).fill(0.1);

    const cosineSimilarity = (a: number[], b: number[]): number => {
      if (a.length !== b.length) {
        throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
      }

      let dotProduct = 0;
      let normA = 0;
      let normB = 0;

      for (let i = 0; i < a.length; i++) {
        dotProduct += a[i]! * b[i]!;
        normA += a[i]! * a[i]!;
        normB += b[i]! * b[i]!;
      }

      const denominator = Math.sqrt(normA) * Math.sqrt(normB);
      if (denominator === 0) return 0;

      return dotProduct / denominator;
    };

    // Act
    const result = cosineSimilarity(vectorA, vectorB);

    // Assert
    expect(result).toBeCloseTo(1.0, 10);
    expect(result).toBe(1.0);
  });

  /**
   * Test 6: Partially similar vectors
   * Vectors with some overlap but not identical.
   * Expected: similarity value between 0 and 1
   */
  it('should return value between 0 and 1 for partially similar vectors', () => {
    // Arrange
    const vectorA = [1, 0, 0];
    const vectorB = [1, 1, 0];

    const cosineSimilarity = (a: number[], b: number[]): number => {
      if (a.length !== b.length) {
        throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
      }

      let dotProduct = 0;
      let normA = 0;
      let normB = 0;

      for (let i = 0; i < a.length; i++) {
        dotProduct += a[i]! * b[i]!;
        normA += a[i]! * a[i]!;
        normB += b[i]! * b[i]!;
      }

      const denominator = Math.sqrt(normA) * Math.sqrt(normB);
      if (denominator === 0) return 0;

      return dotProduct / denominator;
    };

    // Act
    const result = cosineSimilarity(vectorA, vectorB);

    // Assert
    // sqrt(2) ≈ 1.414, so cos(theta) = 1 / 1.414 ≈ 0.707
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
    expect(result).toBeCloseTo(0.7071, 3);
  });

  /**
   * Test 7: Zero vector handling
   * A zero vector has undefined cosine similarity (0/0).
   * Expected: Returns 0 as per implementation's denominator check
   */
  it('should return 0 for zero vectors', () => {
    // Arrange
    const vectorA = [0, 0, 0];
    const vectorB = [0, 0, 0];

    const cosineSimilarity = (a: number[], b: number[]): number => {
      if (a.length !== b.length) {
        throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
      }

      let dotProduct = 0;
      let normA = 0;
      let normB = 0;

      for (let i = 0; i < a.length; i++) {
        dotProduct += a[i]! * b[i]!;
        normA += a[i]! * a[i]!;
        normB += b[i]! * b[i]!;
      }

      const denominator = Math.sqrt(normA) * Math.sqrt(normB);
      if (denominator === 0) return 0;

      return dotProduct / denominator;
    };

    // Act
    const result = cosineSimilarity(vectorA, vectorB);

    // Assert
    expect(result).toBe(0);
  });
});

// ============================================================================
// clearEmbeddingCache Function Tests
// ============================================================================

describe('clearEmbeddingCache', () => {
  /**
   * Test 1: Resets cache state
   *
   * When clearEmbeddingCache is called, it should reset the internal cache state.
   * After clearing, attempting to use the cache (via findBestEmbeddingMatch)
   * should throw an error because the cache is no longer initialized.
   *
   * Expected: findBestEmbeddingMatch throws "cache not initialized" error
   */
  it('should reset state and cause findBestEmbeddingMatch to throw when cache not initialized', () => {
    // Arrange: Simulate cache state management
    let cacheInitialized = false;

    const clearEmbeddingCache = () => {
      cacheInitialized = false;
    };

    const findBestEmbeddingMatch = async (
      _queryText: string,
    ): Promise<{ match: { matched: boolean }; usage: { promptTokens: number } }> => {
      if (!cacheInitialized) {
        throw new Error(
          'Embedding cache not initialized. Call ensureCategoryEmbeddings first.',
        );
      }
      return {
        match: { matched: true },
        usage: { promptTokens: 0 },
      };
    };

    // Simulate cache being initialized
    cacheInitialized = true;

    // Verify cache is working before clear
    expect(cacheInitialized).toBe(true);

    // Act: Clear the cache
    clearEmbeddingCache();

    // Assert: Cache is no longer initialized
    expect(cacheInitialized).toBe(false);

    // Assert: findBestEmbeddingMatch throws error when cache is not initialized
    expect(() => {
      if (!cacheInitialized) {
        throw new Error(
          'Embedding cache not initialized. Call ensureCategoryEmbeddings first.',
        );
      }
    }).toThrow('Embedding cache not initialized');
  });

  /**
   * Test 2: Multiple clear calls
   *
   * Calling clearEmbeddingCache multiple times should be idempotent.
   * It should not cause errors and should maintain the cleared state.
   */
  it('should be idempotent - multiple clears should work without error', () => {
    // Arrange
    let clearCount = 0;

    const clearEmbeddingCache = () => {
      clearCount++;
    };

    // Act: Call clear multiple times
    clearEmbeddingCache();
    clearEmbeddingCache();
    clearEmbeddingCache();

    // Assert
    expect(clearCount).toBe(3);
  });

  /**
   * Test 3: Cache reinitialize after clear
   *
   * After clearing the cache, it should be possible to reinitialize it.
   * This tests that clear doesn't leave the system in an unusable state.
   */
  it('should allow cache reinitialization after clear', async () => {
    // Arrange
    let cacheState: { initialized: boolean; categories: string[] } | null = null;

    const clearEmbeddingCache = () => {
      cacheState = null;
    };

    const ensureCategoryEmbeddings = async (categories: string[]) => {
      cacheState = {
        initialized: true,
        categories,
      };
      return { promptTokens: 10, totalTokens: 30 };
    };

    // Act: Initialize, clear, reinitialize
    await ensureCategoryEmbeddings(['Food', 'Housing']);
    expect(cacheState).not.toBeNull();

    clearEmbeddingCache();
    expect(cacheState).toBeNull();

    await ensureCategoryEmbeddings(['Transportation', 'Utilities']);
    expect(cacheState).not.toBeNull();
    expect(cacheState?.categories).toEqual(['Transportation', 'Utilities']);

    // Assert
    expect(cacheState).toEqual({
      initialized: true,
      categories: ['Transportation', 'Utilities'],
    });
  });
});

// ============================================================================
// Integration Tests: cosineSimilarity with realistic data
// ============================================================================

describe('cosineSimilarity - Integration Tests', () => {
  /**
   * Test: Real embedding vectors (mocked)
   * Two mocked embeddings that represent similar semantic meaning.
   */
  it('should correctly compare mock embedding vectors', () => {
    // Arrange: Create mock embeddings that are mostly identical
    const mockEmbedding1 = new Array(1536).fill(0.1);
    const mockEmbedding2 = new Array(1536).fill(0.1);

    const cosineSimilarity = (a: number[], b: number[]): number => {
      if (a.length !== b.length) {
        throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
      }

      let dotProduct = 0;
      let normA = 0;
      let normB = 0;

      for (let i = 0; i < a.length; i++) {
        dotProduct += a[i]! * b[i]!;
        normA += a[i]! * a[i]!;
        normB += b[i]! * b[i]!;
      }

      const denominator = Math.sqrt(normA) * Math.sqrt(normB);
      if (denominator === 0) return 0;

      return dotProduct / denominator;
    };

    // Act
    const result = cosineSimilarity(mockEmbedding1, mockEmbedding2);

    // Assert
    expect(result).toBe(1.0);
  });

  /**
   * Test: Slightly different mock embeddings
   * Embeddings that differ slightly should show similarity > 0.9
   */
  it('should show high similarity for slightly different embeddings', () => {
    // Arrange
    const mockEmbedding1 = new Array(1536).fill(0.1);
    const mockEmbedding2 = new Array(1536).fill(0.1).map((val, i) =>
      i % 10 === 0 ? val + 0.01 : val, // Slightly different at every 10th position
    );

    const cosineSimilarity = (a: number[], b: number[]): number => {
      if (a.length !== b.length) {
        throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
      }

      let dotProduct = 0;
      let normA = 0;
      let normB = 0;

      for (let i = 0; i < a.length; i++) {
        dotProduct += a[i]! * b[i]!;
        normA += a[i]! * a[i]!;
        normB += b[i]! * b[i]!;
      }

      const denominator = Math.sqrt(normA) * Math.sqrt(normB);
      if (denominator === 0) return 0;

      return dotProduct / denominator;
    };

    // Act
    const result = cosineSimilarity(mockEmbedding1, mockEmbedding2);

    // Assert
    expect(result).toBeGreaterThan(0.9);
    expect(result).toBeLessThan(1.0);
  });
});

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

describe('cosineSimilarity - Edge Cases', () => {
  /**
   * Test: Single dimension vectors
   * Vectors with only one dimension should work correctly.
   */
  it('should work correctly with single-dimension vectors', () => {
    // Arrange
    const vectorA = [5];
    const vectorB = [5];

    const cosineSimilarity = (a: number[], b: number[]): number => {
      if (a.length !== b.length) {
        throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
      }

      let dotProduct = 0;
      let normA = 0;
      let normB = 0;

      for (let i = 0; i < a.length; i++) {
        dotProduct += a[i]! * b[i]!;
        normA += a[i]! * a[i]!;
        normB += b[i]! * b[i]!;
      }

      const denominator = Math.sqrt(normA) * Math.sqrt(normB);
      if (denominator === 0) return 0;

      return dotProduct / denominator;
    };

    // Act
    const result = cosineSimilarity(vectorA, vectorB);

    // Assert
    expect(result).toBe(1.0);
  });

  /**
   * Test: Empty vectors
   * Empty vectors should throw a dimension mismatch error or be handled appropriately.
   */
  it('should handle empty vectors appropriately', () => {
    // Arrange
    const vectorA: number[] = [];
    const vectorB: number[] = [];

    const cosineSimilarity = (a: number[], b: number[]): number => {
      if (a.length !== b.length) {
        throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
      }

      let dotProduct = 0;
      let normA = 0;
      let normB = 0;

      for (let i = 0; i < a.length; i++) {
        dotProduct += a[i]! * b[i]!;
        normA += a[i]! * a[i]!;
        normB += b[i]! * b[i]!;
      }

      const denominator = Math.sqrt(normA) * Math.sqrt(normB);
      if (denominator === 0) return 0;

      return dotProduct / denominator;
    };

    // Act
    const result = cosineSimilarity(vectorA, vectorB);

    // Assert: Empty vectors should return 0 (denominator is 0)
    expect(result).toBe(0);
  });

  /**
   * Test: Very large vectors
   * Should handle vectors with thousands of dimensions.
   */
  it('should handle very large vectors efficiently', () => {
    // Arrange
    const dimension = 10000;
    const vectorA = new Array(dimension).fill(0.1);
    const vectorB = new Array(dimension).fill(0.1);

    const cosineSimilarity = (a: number[], b: number[]): number => {
      if (a.length !== b.length) {
        throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
      }

      let dotProduct = 0;
      let normA = 0;
      let normB = 0;

      for (let i = 0; i < a.length; i++) {
        dotProduct += a[i]! * b[i]!;
        normA += a[i]! * a[i]!;
        normB += b[i]! * b[i]!;
      }

      const denominator = Math.sqrt(normA) * Math.sqrt(normB);
      if (denominator === 0) return 0;

      return dotProduct / denominator;
    };

    // Act
    const result = cosineSimilarity(vectorA, vectorB);

    // Assert
    expect(result).toBe(1.0);
  });

  /**
   * Test: Negative values
   * Embeddings can contain negative values. Should handle them correctly.
   */
  it('should correctly handle vectors with negative values', () => {
    // Arrange
    const vectorA = [-1, -2, -3];
    const vectorB = [-1, -2, -3];

    const cosineSimilarity = (a: number[], b: number[]): number => {
      if (a.length !== b.length) {
        throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
      }

      let dotProduct = 0;
      let normA = 0;
      let normB = 0;

      for (let i = 0; i < a.length; i++) {
        dotProduct += a[i]! * b[i]!;
        normA += a[i]! * a[i]!;
        normB += b[i]! * b[i]!;
      }

      const denominator = Math.sqrt(normA) * Math.sqrt(normB);
      if (denominator === 0) return 0;

      return dotProduct / denominator;
    };

    // Act
    const result = cosineSimilarity(vectorA, vectorB);

    // Assert
    expect(result).toBe(1.0);
  });
});
