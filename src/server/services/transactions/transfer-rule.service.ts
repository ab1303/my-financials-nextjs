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
