/**
 * Category Matching Service
 * Fuzzy matches extracted category names to database categories
 */

/**
 * Compute Levenshtein distance between two strings
 * Used for fuzzy matching category names
 */
function levenshteinDistance(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();

  if (aLower === bLower) return 0;
  if (aLower.length < bLower.length) {
    return levenshteinDistance(bLower, aLower);
  }
  if (bLower.length === 0) return aLower.length;

  const previousRow = Array.from({ length: bLower.length + 1 }, (_, i) => i);
  for (let i = 0; i < aLower.length; i++) {
    const currentRow = [i + 1];
    for (let j = 0; j < bLower.length; j++) {
      const insertions = previousRow[j + 1]! + 1;
      const deletions = currentRow[j]! + 1;
      const substitutions = previousRow[j]! + (aLower[i] !== bLower[j] ? 1 : 0);
      currentRow.push(Math.min(insertions, deletions, substitutions));
    }
    previousRow.splice(0, previousRow.length, ...currentRow);
  }
  return previousRow[bLower.length]!;
}

/**
 * Check if extracted text is similar to a category
 */
function _isSimilar(
  extractedText: string,
  category: string,
  threshold = 0.75,
): boolean {
  const distance = levenshteinDistance(extractedText, category);
  const maxLength = Math.max(extractedText.length, category.length);
  const similarity = 1 - distance / maxLength;
  return similarity >= threshold;
}

/**
 * Match extracted category name to available categories
 * Uses multiple strategies: exact match, substring match, similarity
 */
export function matchCategory(
  extractedName: string,
  availableCategories: string[],
): string | null {
  const normalized = extractedName.toLowerCase().trim();

  // Strategy 1: Exact match (case-insensitive)
  const exactMatch = availableCategories.find(
    (cat) => cat.toLowerCase() === normalized,
  );
  if (exactMatch) return exactMatch;

  // Strategy 2: Substring match (both directions)
  const substringMatch = availableCategories.find(
    (cat) =>
      normalized.includes(cat.toLowerCase()) ||
      cat.toLowerCase().includes(normalized),
  );
  if (substringMatch) return substringMatch;

  // Strategy 3: Fuzzy/similarity matching
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const category of availableCategories) {
    const score =
      1 -
      levenshteinDistance(normalized, category.toLowerCase()) /
        Math.max(normalized.length, category.length);

    // Require high similarity threshold
    if (score > bestScore && score >= 0.7) {
      bestScore = score;
      bestMatch = category;
    }
  }

  return bestMatch;
}

/**
 * Match multiple extracted categories to available categories
 * Returns array of matched category IDs, with unmatched entries using "Other" fallback
 */
export function matchCategories(
  extractedNames: string[],
  categoryMap: Record<string, string>, // name -> id mapping
): Array<{
  extracted: string;
  matchedName: string;
  matchedId: string;
  isMatched: boolean;
}> {
  const availableNames = Object.keys(categoryMap);
  const otherCategory = availableNames.find(
    (cat) => cat.toLowerCase() === 'other',
  );
  const otherCategoryId = otherCategory ? categoryMap[otherCategory] : null;

  return extractedNames.map((extracted) => {
    const matched = matchCategory(extracted, availableNames);

    if (matched) {
      return {
        extracted,
        matchedName: matched,
        matchedId: categoryMap[matched]!,
        isMatched: true,
      };
    }

    // Fallback to "Other" if no match found
    return {
      extracted,
      matchedName: 'Other',
      matchedId: otherCategoryId || '',
      isMatched: false,
    };
  });
}

/**
 * Semantic category matching using AI embeddings
 * Replaces the static SEMANTIC_MAPPINGS with dynamic embedding-based matching
 */

import {
  ensureCategoryEmbeddings,
  findBestCategoryMatch,
  findBestCategoryMatchWithRetry,
} from './embedding.service';
import type { AITokenUsage } from './_types';

/**
 * Enhanced matching with AI embeddings.
 * Tiered strategy: exact → substring → embedding → fuzzy.
 *
 * Returns the matched category name and accumulated embedding token usage.
 */
export async function matchCategoryWithEmbedding(
  extractedName: string,
  availableCategories: { name: string; id: string; createdAt: Date; iconName: string | null; isActive: boolean }[],
): Promise<{
  categoryName: string | null;
  embeddingUsage: AITokenUsage;
}> {
  const normalized = extractedName.toLowerCase().trim();
  const zeroUsage: AITokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  // Strategy 1: Exact match (case-insensitive) — instant, no API call
  const exactMatch = availableCategories.find(
    (cat) => cat.name.toLowerCase() === normalized,
  );
  if (exactMatch) {
    return { categoryName: exactMatch.name, embeddingUsage: zeroUsage };
  }

  // Strategy 2: Substring match — instant, no API call
  const substringMatch = availableCategories.find(
    (cat) =>
      normalized.includes(cat.name.toLowerCase()) ||
      cat.name.toLowerCase().includes(normalized),
  );
  if (substringMatch) {
    return { categoryName: substringMatch.name, embeddingUsage: zeroUsage };
  }

  // Strategy 3: Embedding cosine similarity (with retry for rate-limit resilience)
  try {
    // Ensure category embeddings are cached (no-op if already cached)
    const cacheUsage = await ensureCategoryEmbeddings(availableCategories);

    const result = await findBestCategoryMatchWithRetry(extractedName, availableCategories);

    if (!result) {
      // No match found above threshold
      return { categoryName: null, embeddingUsage: cacheUsage };
    }

    const totalUsage: AITokenUsage = {
      promptTokens: cacheUsage.promptTokens,
      completionTokens: 0,
      totalTokens: cacheUsage.totalTokens,
    };

    return { categoryName: result.category.name, embeddingUsage: totalUsage };
  } catch (error) {
    // Graceful degradation: fall back to Levenshtein fuzzy matching
    console.warn(
      '[CategoryMatcher] Embedding unavailable, falling back to fuzzy matching:',
      error instanceof Error ? error.message : error,
    );

    const fuzzyMatch = matchCategory(
      extractedName,
      availableCategories.map((c) => c.name),
    );
    return { categoryName: fuzzyMatch, embeddingUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } };
  }
}

