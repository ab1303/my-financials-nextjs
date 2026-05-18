/**
 * Embedding Service
 * Handles semantic embedding-based category matching using OpenAI's text-embedding-3-small model.
 * Features: caching, concurrency safety, graceful degradation.
 */

import { embed, embedMany } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { ExpenseCategory } from '@prisma/client';
import type { AITokenUsage } from './_types';

// --- 1. Pure Functions ---

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!Array.isArray(a) || !Array.isArray(b)) throw new Error('Inputs must be arrays');
  if (a.length !== b.length) throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  if (a.length === 0) return 0;

  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return Math.max(-1, Math.min(1, dot / denominator));
}

function getCategoryFingerprint(categories: ExpenseCategory[]): string {
  return categories
    .map((c) => c.name.trim())
    .sort((a, b) => a.localeCompare(b))
    .join('|');
}

// --- 2. Embedding Provider ---

export function getEmbeddingProvider() {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) throw new Error('AI_API_KEY is required for embedding service.');
  const provider = process.env.AI_PROVIDER || 'github';
  const model = process.env.AI_EMBEDDING_MODEL || 'text-embedding-3-small';
  const baseURL = process.env.AI_BASE_URL;

  const openai = createOpenAI({
    apiKey,
    ...(baseURL
      ? { baseURL }
      : provider === 'github' && { baseURL: 'https://models.inference.ai.azure.com' }),
  });

  return openai.embedding(model);
}

// --- 3. Module-level Cache ---

interface CachedEmbeddings {
  fingerprint: string;
  embeddings: Map<string, number[]>; // categoryName -> vector
}

let cachedEmbeddings: CachedEmbeddings | null = null;
let initializationPromise: Promise<AITokenUsage> | null = null;

// --- 4. Ensure Category Embeddings ---

type CategoryLike = { name: string };

export async function ensureCategoryEmbeddings(
  categories: CategoryLike[]
): Promise<AITokenUsage> {
  const fingerprint = getCategoryFingerprint(categories as ExpenseCategory[]);

  // Cache hit — categories haven't changed
  if (cachedEmbeddings?.fingerprint === fingerprint) {
    return {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUSD: 0,
    };
  }

  // Concurrency lock — if another request is already initializing, await it
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      const model = getEmbeddingProvider();

      const categoryNames = categories.map((c) => c.name);

      const { embeddings, usage } = await embedMany({
        model,
        values: categoryNames,
      });

      const embeddingMap = new Map<string, number[]>();
      categoryNames.forEach((name, index) => {
        embeddingMap.set(name, embeddings[index]!);
      });

      cachedEmbeddings = { fingerprint, embeddings: embeddingMap };

      const promptTokens = usage?.tokens ?? 0;
      const totalTokens = usage?.tokens ?? 0;
      const estimatedCostUSD = Number(((totalTokens / 1_000_000) * 0.02).toFixed(6));

      return {
        promptTokens,
        completionTokens: 0,
        totalTokens,
        estimatedCostUSD,
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
      `Invalid AI_EMBEDDING_SIMILARITY_THRESHOLD: "${envThreshold}". Using default ${DEFAULT_SIMILARITY_THRESHOLD}.`
    );
    return DEFAULT_SIMILARITY_THRESHOLD;
  }
  return parsed;
}

// --- 5. Find Best Category Match ---

export async function findBestCategoryMatch<T extends { name: string }>(
  text: string,
  categories: T[]
): Promise<{ category: T; similarity: number } | null> {
  if (!categories || categories.length === 0) return null;

  await ensureCategoryEmbeddings(categories);

  const model = getEmbeddingProvider();
  const { embedding } = await embed({
    model,
    value: text,
  });

  const threshold = getSimilarityThreshold();
  let bestMatch: T | null = null;
  let bestScore = 0;

  if (cachedEmbeddings) {
    for (const category of categories) {
      const categoryEmbedding = cachedEmbeddings.embeddings.get(category.name);
      if (!categoryEmbedding) continue;

      const similarity = cosineSimilarity(embedding, categoryEmbedding);
      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = category;
      }
    }
  }

  if (bestMatch && bestScore >= threshold) {
    return { category: bestMatch, similarity: bestScore };
  }

  return null;
}

// --- 6. Find Best Category Match With Retry ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function findBestCategoryMatchWithRetry<T extends { name: string }>(
  text: string,
  categories: T[],
  maxRetries: number = 3
): Promise<{ category: T; similarity: number } | null> {
  const backoffs = [1000, 2000, 4000];
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await findBestCategoryMatch(text, categories);
    } catch (error: any) {
      const isRetryable =
        error?.code === 'ETIMEDOUT' ||
        error?.status === 429 ||
        error?.status === 500;
      if (!isRetryable || attempt >= maxRetries) return null;
      await sleep(backoffs[attempt] || 4000);
    }
  }
  return null;
}

// --- 7. Clear Embedding Cache ---

export function clearEmbeddingCache(): void {
  cachedEmbeddings = null;
  initializationPromise = null;
}
