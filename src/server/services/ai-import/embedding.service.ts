/**
 * Embedding Service
 * Handles semantic embedding-based category matching using OpenAI's text-embedding-3-small model.
 * Features: caching, concurrency safety, graceful degradation.
 */

import { embed, embedMany } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { AITokenUsage, EmbeddingMatchResult } from './_types';

const GITHUB_MODELS_BASE_URL = 'https://models.inference.ai.azure.com';

/**
 * Get embedding provider based on AI_PROVIDER environment variable.
 * Mirrors the pattern from ai-vision.service.ts but for embeddings.
 */
function getEmbeddingProvider() {
  const provider = process.env.AI_PROVIDER ?? 'github';
  const modelId = process.env.AI_EMBEDDING_MODEL ?? 'text-embedding-3-small';
  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) {
    throw new Error('AI_API_KEY is required for embedding service.');
  }

  const openai = createOpenAI({
    apiKey,
    ...(provider === 'github' && { baseURL: GITHUB_MODELS_BASE_URL }),
  });

  return openai.embedding(modelId);
}

/**
 * Compute cosine similarity between two vectors.
 * Returns value between -1 and 1 (1 = identical direction).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
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
}

interface CachedEmbeddings {
  fingerprint: string; // sorted category names joined — detects changes
  embeddings: Map<string, number[]>; // categoryName → embedding vector
}

let cachedEmbeddings: CachedEmbeddings | null = null;
let initializationPromise: Promise<AITokenUsage> | null = null;

/**
 * Generate a fingerprint from category names to detect when
 * the category list has changed (requires re-embedding).
 */
function getCategoryFingerprint(categories: string[]): string {
  return [...categories].sort().join('|');
}

/**
 * Embed all category names and cache the results.
 * Uses a Promise lock to prevent parallel embedMany() calls.
 *
 * Returns token usage for AIUsageLog tracking.
 */
export async function ensureCategoryEmbeddings(
  categoryNames: string[],
): Promise<AITokenUsage> {
  const fingerprint = getCategoryFingerprint(categoryNames);

  // Cache hit — categories haven't changed
  if (cachedEmbeddings?.fingerprint === fingerprint) {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }

  // Concurrency lock — if another request is already initializing, await it
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      const model = getEmbeddingProvider();

      const { embeddings, usage } = await embedMany({
        model,
        values: categoryNames,
      });

      const embeddingMap = new Map<string, number[]>();
      categoryNames.forEach((name, index) => {
        embeddingMap.set(name, embeddings[index]!);
      });

      cachedEmbeddings = { fingerprint, embeddings: embeddingMap };

      return {
        promptTokens: usage?.tokens ?? 0,
        completionTokens: 0,
        totalTokens: usage?.tokens ?? 0,
      };
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

const DEFAULT_SIMILARITY_THRESHOLD = 0.75;

function getSimilarityThreshold(): number {
  const envThreshold = process.env.AI_EMBEDDING_SIMILARITY_THRESHOLD;
  if (!envThreshold) return DEFAULT_SIMILARITY_THRESHOLD;

  const parsed = parseFloat(envThreshold);
  if (isNaN(parsed) || parsed < 0 || parsed > 1) {
    console.warn(
      `Invalid AI_EMBEDDING_SIMILARITY_THRESHOLD: "${envThreshold}". Using default ${DEFAULT_SIMILARITY_THRESHOLD}.`,
    );
    return DEFAULT_SIMILARITY_THRESHOLD;
  }
  return parsed;
}

/**
 * Embed a single extracted category name and find the best matching
 * category from the cached embeddings using cosine similarity.
 *
 * Returns the match result and token usage.
 */
export async function findBestEmbeddingMatch(
  extractedName: string,
): Promise<{ match: EmbeddingMatchResult; usage: AITokenUsage }> {
  if (!cachedEmbeddings) {
    throw new Error(
      'Category embeddings not initialized. Call ensureCategoryEmbeddings() first.',
    );
  }

  const model = getEmbeddingProvider();
  const { embedding, usage } = await embed({
    model,
    value: extractedName,
  });

  const threshold = getSimilarityThreshold();
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const [categoryName, categoryEmbedding] of cachedEmbeddings.embeddings) {
    const similarity = cosineSimilarity(embedding, categoryEmbedding);
    if (similarity > bestScore) {
      bestScore = similarity;
      bestMatch = categoryName;
    }
  }

  const tokenUsage: AITokenUsage = {
    promptTokens: usage?.tokens ?? 0,
    completionTokens: 0,
    totalTokens: usage?.tokens ?? 0,
  };

  if (bestMatch && bestScore >= threshold) {
    return {
      match: {
        matched: true,
        categoryName: bestMatch,
        similarity: bestScore,
        method: 'embedding',
      },
      usage: tokenUsage,
    };
  }

  return {
    match: {
      matched: false,
      categoryName: null,
      similarity: bestScore,
      method: 'embedding',
    },
    usage: tokenUsage,
  };
}

/**
 * Clear the cached embeddings. Used in tests and for future
 * admin-triggered cache invalidation.
 */
export function clearEmbeddingCache(): void {
  cachedEmbeddings = null;
  initializationPromise = null;
}
