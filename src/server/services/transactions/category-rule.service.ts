import type { PrismaClient } from "@prisma/client";
import { CategoryRuleMatchType } from "@prisma/client";

export type { CategoryRuleMatchType };

export interface CategoryRuleInput {
  pattern: string;
  matchType: CategoryRuleMatchType;
  category: string;
  name: string;
}

export interface CategoryRuleListItem {
  id: string;
  name: string;
  matchType: CategoryRuleMatchType;
  pattern: string;
  category: string;
  isActive: boolean;
  appliedCount: number;
  createdAt: string;
}

/**
 * Creates a new category rule for the user.
 */
export async function createRule(
  params: { prisma: PrismaClient; userId: string } & CategoryRuleInput,
): Promise<CategoryRuleListItem> {
  const { prisma, userId, name, pattern, matchType, category } = params;

  const rule = await (prisma.categoryRule as any).create({
    data: {
      userId,
      name,
      pattern,
      matchType,
      category,
    },
  });

  return {
    id: rule.id,
    name: rule.name,
    matchType: rule.matchType,
    pattern: rule.pattern,
    category: rule.category,
    isActive: rule.isActive,
    appliedCount: rule.appliedCount,
    createdAt: rule.createdAt.toISOString(),
  };
}

/**
 * Lists all rules for the user, ordered by createdAt desc.
 */
export async function listRules(params: {
  prisma: PrismaClient;
  userId: string;
}): Promise<CategoryRuleListItem[]> {
  const rules = await (params.prisma.categoryRule as any).findMany({
    where: { userId: params.userId },
    orderBy: { createdAt: "desc" },
  });

  return rules.map((rule: any) => ({
    id: rule.id,
    name: rule.name,
    matchType: rule.matchType,
    pattern: rule.pattern,
    category: rule.category,
    isActive: rule.isActive,
    appliedCount: rule.appliedCount,
    createdAt: rule.createdAt.toISOString(),
  }));
}

/**
 * Toggles the isActive status of a rule.
 * Verifies ownership before updating.
 */
export async function toggleRule(params: {
  prisma: PrismaClient;
  userId: string;
  ruleId: string;
  isActive: boolean;
}): Promise<void> {
  const rule = await (params.prisma.categoryRule as any).findUnique({
    where: { id: params.ruleId },
  });

  if (!rule || rule.userId !== params.userId) {
    throw new Error("Rule not found");
  }

  await (params.prisma.categoryRule as any).update({
    where: { id: params.ruleId },
    data: { isActive: params.isActive },
  });
}

/**
 * Deletes a rule.
 * Verifies ownership before deleting.
 */
export async function deleteRule(params: {
  prisma: PrismaClient;
  userId: string;
  ruleId: string;
}): Promise<void> {
  const rule = await (params.prisma.categoryRule as any).findUnique({
    where: { id: params.ruleId },
  });

  if (!rule || rule.userId !== params.userId) {
    throw new Error("Rule not found or not authorized");
  }

  await (params.prisma.categoryRule as any).delete({
    where: { id: params.ruleId },
  });
}

const STOP_WORDS = new Set([
  "to",
  "from",
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "in",
  "at",
  "on",
  "for",
  "by",
]);

/**
 * Extracts a pattern from a description.
 * Pattern is first 3 meaningful words (>2 chars, not in STOP_WORDS).
 */
function extractPattern(description: string): string {
  const words = description
    .toLowerCase()
    .split(/\W+/)
    .filter(Boolean)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .slice(0, 3);

  return words.join(" ");
}

/**
 * Finds count of transactions matching a pattern (case-insensitive CONTAINS).
 * Excludes the transaction with excludeTransactionId if provided.
 */
export async function findSimilarTransactions(params: {
  prisma: PrismaClient;
  userId: string;
  description: string;
  excludeTransactionId?: string;
}): Promise<number> {
  const pattern = extractPattern(params.description);

  if (!pattern) {
    return 0;
  }

  const count = await (params.prisma.transaction as any).count({
    where: {
      userId: params.userId,
      description: {
        contains: pattern,
        mode: "insensitive",
      },
      ...(params.excludeTransactionId && {
        id: { not: params.excludeTransactionId },
      }),
    },
  });

  return count;
}

/**
 * Builds a Prisma description filter for a rule's matchType and pattern.
 * Pushes pattern matching into the database rather than JS memory.
 */
function buildDescriptionFilter(matchType: CategoryRuleMatchType, pattern: string) {
  if (matchType === CategoryRuleMatchType.STARTS_WITH) {
    return { startsWith: pattern, mode: "insensitive" as const };
  }
  if (matchType === CategoryRuleMatchType.EXACT) {
    return { equals: pattern, mode: "insensitive" as const };
  }
  // CONTAINS (default)
  return { contains: pattern, mode: "insensitive" as const };
}

/**
 * Applies category rules to transactions in an import session.
 * Only processes transactions with source=LLM_CLASSIFIED.
 * Uses one DB updateMany per rule — no in-memory transaction scanning.
 * Returns count of rules run and total applied.
 */
export async function runCategoryRules(params: {
  prisma: PrismaClient;
  userId: string;
  importSessionId: string;
}): Promise<{ rulesRan: number; appliedCount: number }> {
  const rules = await (params.prisma.categoryRule as any).findMany({
    where: { userId: params.userId, isActive: true },
  });

  let totalApplied = 0;

  for (const rule of rules) {
    const result = await (params.prisma.transaction as any).updateMany({
      where: {
        userId: params.userId,
        importSessionId: params.importSessionId,
        source: "LLM_CLASSIFIED",
        status: { in: ["PENDING", "CONFIRMED"] },
        description: buildDescriptionFilter(rule.matchType, rule.pattern),
      },
      data: { category: rule.category, source: "USER_OVERRIDE" },
    });

    if (result.count > 0) {
      await (params.prisma.categoryRule as any).update({
        where: { id: rule.id },
        data: { appliedCount: { increment: result.count } },
      });
      totalApplied += result.count;
    }
  }

  return { rulesRan: rules.length, appliedCount: totalApplied };
}

/**
 * Applies a rule to past transactions matching its pattern.
 * Uses a single DB updateMany — no rows are loaded into memory.
 * Returns count of updated transactions.
 */
export async function applyRuleToPast(params: {
  prisma: PrismaClient;
  userId: string;
  ruleId: string;
}): Promise<number> {
  const rule = await (params.prisma.categoryRule as any).findUnique({
    where: { id: params.ruleId },
  });

  if (!rule || rule.userId !== params.userId) {
    throw new Error("Rule not found or not authorized");
  }

  const result = await (params.prisma.transaction as any).updateMany({
    where: {
      userId: params.userId,
      status: { not: "VOIDED" },
      description: buildDescriptionFilter(rule.matchType, rule.pattern),
    },
    data: { category: rule.category, source: "USER_OVERRIDE" },
  });

  return result.count;
}
