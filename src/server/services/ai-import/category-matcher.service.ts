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
 * Semantic category matching using predefined mappings
 * Handles common variations like "Petrol" -> "Transportation"
 */
const SEMANTIC_MAPPINGS: Record<string, string> = {
  // Transportation aliases
  petrol: 'Transportation',
  fuel: 'Transportation',
  gas: 'Transportation',
  parking: 'Transportation',
  taxi: 'Transportation',
  uber: 'Transportation',
  car: 'Transportation',

  // Food aliases
  groceries: 'Food',
  dining: 'Food',
  restaurant: 'Food',
  lunch: 'Food',
  dinner: 'Food',
  breakfast: 'Food',
  cafe: 'Food',

  // Utilities aliases
  electricity: 'Utilities',
  water: 'Utilities',
  internet: 'Utilities',
  phone: 'Utilities',
  mobile: 'Utilities',

  // Housing aliases
  rent: 'Housing',
  mortgage: 'Housing',
  house: 'Housing',
  property: 'Housing',

  // Entertainment aliases
  streaming: 'Entertainment',
  movies: 'Entertainment',
  cinema: 'Entertainment',
  games: 'Entertainment',
  hobby: 'Entertainment',

  // Healthcare aliases
  doctor: 'Healthcare',
  pharmacy: 'Healthcare',
  medicine: 'Healthcare',
  hospital: 'Healthcare',
  dental: 'Healthcare',
  medical: 'Healthcare',

  // Insurance aliases
  car_insurance: 'Insurance',
  home_insurance: 'Insurance',
  travel_insurance: 'Insurance',

  // Personal aliases
  clothing: 'Personal',
  clothes: 'Personal',
  salon: 'Personal',
  haircut: 'Personal',
  beauty: 'Personal',
  grooming: 'Personal',

  // Education aliases
  tuition: 'Education',
  course: 'Education',
  school: 'Education',
  book: 'Education',
  training: 'Education',
};

/**
 * Enhanced matching with semantic understanding
 * First tries semantic mapping, then falls back to fuzzy matching
 */
export function matchCategoryWithSemantics(
  extractedName: string,
  availableCategories: string[],
): string | null {
  const normalized = extractedName.toLowerCase().trim();

  // Strategy 1: Semantic mapping
  const semanticMatch = SEMANTIC_MAPPINGS[normalized];
  if (semanticMatch && availableCategories.includes(semanticMatch)) {
    return semanticMatch;
  }

  // Strategy 2: Check if any semantic value matches
  for (const [key, semanticCat] of Object.entries(SEMANTIC_MAPPINGS)) {
    if (
      normalized.includes(key) ||
      key.includes(normalized.replace(/\s+/g, '_'))
    ) {
      if (availableCategories.includes(semanticCat)) {
        return semanticCat;
      }
    }
  }

  // Strategy 3: Fall back to regular fuzzy matching
  return matchCategory(extractedName, availableCategories);
}
