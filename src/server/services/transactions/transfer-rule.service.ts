import type { PrismaClient } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';

export interface CreateRuleInput {
  userId: string;
  name: string;
  amountExact: Decimal;
  debitKeywords: string[];
  creditKeywords: string[];
  maxDayGap: number;
  debitBankAccountId: string | null;
  creditBankAccountId: string | null;
  confidenceThreshold?: number;
}

export interface RuleListItem {
  id: string;
  name: string;
  isActive: boolean;
  amountExact: number | null;
  debitKeywords: string[];
  creditKeywords: string[];
  maxDayGap: number;
  confidenceThreshold: number;
  matchCount: number;
  lastMatchedAt: string | null;
}

export async function createRule(
  params: CreateRuleInput & { prisma: PrismaClient },
): Promise<RuleListItem> {
  const {
    prisma,
    userId,
    name,
    amountExact,
    debitKeywords,
    creditKeywords,
    maxDayGap,
    debitBankAccountId,
    creditBankAccountId,
    confidenceThreshold = 85,
  } = params;
  const rule = await (prisma.transferMatchRule as any).create({
    data: {
      userId,
      name,
      amountExact,
      debitKeywords,
      creditKeywords,
      maxDayGap,
      debitBankAccountId,
      creditBankAccountId,
      confidenceThreshold,
    },
  });
  return {
    id: rule.id,
    name: rule.name,
    isActive: rule.isActive,
    amountExact: rule.amountExact ? Number(rule.amountExact) : null,
    debitKeywords: rule.debitKeywords,
    creditKeywords: rule.creditKeywords,
    maxDayGap: rule.maxDayGap,
    confidenceThreshold: rule.confidenceThreshold,
    matchCount: rule.matchCount,
    lastMatchedAt: rule.lastMatchedAt ? rule.lastMatchedAt.toISOString() : null,
  };
}

export async function listRules(params: {
  prisma: PrismaClient;
  userId: string;
}): Promise<RuleListItem[]> {
  const rules = await (params.prisma.transferMatchRule as any).findMany({
    where: { userId: params.userId },
    orderBy: { createdAt: 'desc' },
  });
  return rules.map((rule: any) => ({
    id: rule.id,
    name: rule.name,
    isActive: rule.isActive,
    amountExact: rule.amountExact ? Number(rule.amountExact) : null,
    debitKeywords: rule.debitKeywords,
    creditKeywords: rule.creditKeywords,
    maxDayGap: rule.maxDayGap,
    confidenceThreshold: rule.confidenceThreshold,
    matchCount: rule.matchCount,
    lastMatchedAt: rule.lastMatchedAt ? rule.lastMatchedAt.toISOString() : null,
  }));
}

export async function toggleRule(params: {
  prisma: PrismaClient;
  userId: string;
  ruleId: string;
  isActive: boolean;
}): Promise<void> {
  const rule = await (params.prisma.transferMatchRule as any).findUnique({
    where: { id: params.ruleId },
  });
  if (!rule || rule.userId !== params.userId) throw new Error('Rule not found');
  await (params.prisma.transferMatchRule as any).update({
    where: { id: params.ruleId },
    data: { isActive: params.isActive },
  });
}

export async function deleteRule(params: {
  prisma: PrismaClient;
  userId: string;
  ruleId: string;
}): Promise<void> {
  const rule = await (params.prisma.transferMatchRule as any).findUnique({
    where: { id: params.ruleId },
  });
  if (!rule || rule.userId !== params.userId)
    throw new Error('Rule not found or not authorized');
  await (params.prisma.transferMatchRule as any).delete({ where: { id: params.ruleId } });
}

const STOP_WORDS = new Set(['to', 'from', 'the', 'a', 'an', 'and', 'or', 'of', 'in', 'at', 'on', 'for', 'by']);

function extractKeywords(description: string): string[] {
  return description
    .toLowerCase()
    .split(/\W+/)
    .filter(Boolean)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Derive rule parameters from a confirmed linked pair and create the rule.
 * The caller only needs to provide the transaction IDs and a name.
 */
export async function createRuleFromPair(params: {
  prisma: PrismaClient;
  userId: string;
  debitTransactionId: string;
  creditTransactionId: string;
  name: string;
  confidenceThreshold?: number;
}): Promise<RuleListItem> {
  const [debit, credit] = await Promise.all([
    params.prisma.transaction.findUnique({ where: { id: params.debitTransactionId } }),
    params.prisma.transaction.findUnique({ where: { id: params.creditTransactionId } }),
  ]);

  if (!debit || debit.userId !== params.userId) throw new Error('Debit transaction not found');
  if (!credit || credit.userId !== params.userId) throw new Error('Credit transaction not found');

  const dayGap = Math.abs(
    Math.round((debit.date.getTime() - credit.date.getTime()) / (1000 * 60 * 60 * 24)),
  );

  return createRule({
    prisma: params.prisma,
    userId: params.userId,
    name: params.name,
    amountExact: debit.amount,
    debitKeywords: extractKeywords(debit.description),
    creditKeywords: extractKeywords(credit.description),
    maxDayGap: Math.max(dayGap + 3, 7), // pad by 3 days, minimum 7
    debitBankAccountId: debit.bankAccountId,
    creditBankAccountId: credit.bankAccountId,
    confidenceThreshold: params.confidenceThreshold,
  });
}

export async function updateRule(params: {
  prisma: PrismaClient;
  userId: string;
  ruleId: string;
  name?: string;
  maxDayGap?: number;
  confidenceThreshold?: number;
}): Promise<RuleListItem> {
  const rule = await (params.prisma.transferMatchRule as any).findUnique({
    where: { id: params.ruleId },
  });
  if (!rule || rule.userId !== params.userId) throw new Error('Rule not found');
  const updated = await (params.prisma.transferMatchRule as any).update({
    where: { id: params.ruleId },
    data: {
      ...(params.name !== undefined && { name: params.name }),
      ...(params.maxDayGap !== undefined && { maxDayGap: params.maxDayGap }),
      ...(params.confidenceThreshold !== undefined && {
        confidenceThreshold: params.confidenceThreshold,
      }),
    },
  });
  return {
    id: updated.id,
    name: updated.name,
    isActive: updated.isActive,
    amountExact: updated.amountExact ? Number(updated.amountExact) : null,
    debitKeywords: updated.debitKeywords,
    creditKeywords: updated.creditKeywords,
    maxDayGap: updated.maxDayGap,
    confidenceThreshold: updated.confidenceThreshold,
    matchCount: updated.matchCount,
    lastMatchedAt: updated.lastMatchedAt ? updated.lastMatchedAt.toISOString() : null,
  };
}
