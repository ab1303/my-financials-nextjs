import type { CategoryRuleMatchType, PrismaClient } from '@prisma/client';

import type { CsvTransaction } from '@/server/services/ai-import/_types';

export interface Rule {
  id: string;
  name: string;
  pattern: string;
  matchType: CategoryRuleMatchType;
  category: string;
  updatedAt: Date;
}

export interface RuleAnnotation {
  appliedRuleId: string;
  matchedCategory: string;
  matchType: CategoryRuleMatchType;
}

export interface ApplyResult {
  matched: { tx: CsvTransaction; ruleId: string; matchedCategory: string }[];
  unmatched: CsvTransaction[];
  annotations: Map<string, RuleAnnotation>;
}

/**
 * Loads active rules for the user.
 */
export async function loadActiveRules(
  prisma: PrismaClient,
  userId: string,
): Promise<Rule[]> {
  const rules = await (prisma.categoryRule as any).findMany({
    where: { userId, isActive: true },
    select: {
      name: true,
      id: true,
      pattern: true,
      matchType: true,
      category: true,
      updatedAt: true,
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
  });

  return rules;
}

/**
 * Applies category rules to transactions in-memory.
 */
export function applyCategoryRulesToTransactions(
  transactions: CsvTransaction[],
  rules: Rule[],
): ApplyResult {
  const matched: {
    tx: CsvTransaction;
    ruleId: string;
    matchedCategory: string;
  }[] = [];
  const unmatched: CsvTransaction[] = [];
  const annotations = new Map<string, RuleAnnotation>();

  // Sort rules based on precedence: lastUpdatedAt desc, id asc
  const sortedRules = [...rules].sort((a, b) => {
    if (b.updatedAt.getTime() !== a.updatedAt.getTime()) {
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    }
    return a.id.localeCompare(b.id);
  });

  for (const tx of transactions) {
    const description = (tx.description ?? '').trim().toLowerCase();
    let matchedRule = null;

    // matching in-memory
    for (const rule of sortedRules) {
      const pattern = rule.pattern.toLowerCase();
      let isMatch = false;

      if (rule.matchType === 'EXACT') {
        isMatch = description === pattern;
      } else if (rule.matchType === 'CONTAINS') {
        isMatch = description.includes(pattern);
      }

      if (isMatch) {
        matchedRule = rule;
        break;
      }
    }

    if (matchedRule) {
      matched.push({
        tx,
        ruleId: matchedRule.id,
        matchedCategory: matchedRule.category,
      });
      annotations.set(tx.id, {
        appliedRuleId: matchedRule.id,
        matchedCategory: matchedRule.category,
        matchType: matchedRule.matchType,
      });
    } else {
      unmatched.push(tx);
    }
  }

  return { matched, unmatched, annotations };
}
