import type { NextRequest } from 'next/server';

import { normalizeDateToISO } from '@/lib/date-utils';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import type {
  ClassifiedCreditTransaction,
  ClassifiedTransactionV2,
  CsvTransaction,
} from '@/server/services/ai-import/_types';
import {
  classifyCreditTransactions,
  classifyTransactions,
} from '@/server/services/ai-import/csv-classifier.service';
import { ClassifyRequestSchema } from '@/server/services/ai-import/validation';
import { getBankFormat } from '@/server/services/transactions/bank-format-registry';
import {
  applyCategoryRulesToTransactions,
  loadActiveRules,
} from '@/server/services/transactions/category-rule-applier';
import { findDuplicatesForClassifiedMonths } from '@/server/services/transactions/dedup.service';

function groupTransactionsByMonth<T extends CsvTransaction>(transactions: T[]) {
  const monthMap = new Map<string, T[]>();

  for (const tx of transactions) {
    const month = `${tx.year}-${String(tx.month).padStart(2, '0')}`;
    const bucket = monthMap.get(month) ?? [];
    bucket.push(tx);
    monthMap.set(month, bucket);
  }

  return Array.from(monthMap.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function sseEvent(encoder: TextEncoder, payload: Record<string, unknown>) {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
    });
  }

  try {
    const raw = await req.text();
    let body: unknown;
    try {
      body = raw.length ? JSON.parse(raw) : {};
    } catch (parseErr) {
      console.error(
        'CSV classify parse error:',
        parseErr,
        'rawLength:',
        raw.length,
      );
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
      });
    }
    const parse = ClassifyRequestSchema.safeParse(body);

    if (!parse.success) {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
      });
    }

    const { fileId } = parse.data;

    const importSession = await prisma.importSession.findUnique({
      where: { id: fileId },
    });

    if (!importSession) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
      });
    }

    if (importSession.userId !== session.user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
      });
    }

    const metadata = importSession.metadata as Record<string, unknown> | null;
    const bankAccountId =
      typeof metadata?.bankAccountId === 'string' ? metadata.bankAccountId : '';

    if (!bankAccountId) {
      return new Response(
        JSON.stringify({ error: 'Bank account not found in import session' }),
        { status: 400 },
      );
    }

    const financialAccount = await prisma.financialAccount.findUnique({
      where: { id: bankAccountId },
      include: { institution: true },
    });

    const bankFormat = financialAccount?.institution?.institutionKey
      ? getBankFormat(financialAccount.institution.institutionKey)
      : undefined;
    const dateFormat = bankFormat?.dateFormat ?? 'DD/MM/YYYY';

    const transactions = ((
      importSession.metadata as Record<string, unknown> | null
    )?.transactions ?? []) as CsvTransaction[];

    if (!transactions.length) {
      return new Response(
        JSON.stringify({ error: 'No transactions in session' }),
        { status: 400 },
      );
    }

    const rules = await loadActiveRules(prisma, session.user.id);
    const { matched, unmatched, annotations } =
      applyCategoryRulesToTransactions(transactions, rules);

    const debits = unmatched.filter((tx) => tx.type === 'DEBIT');
    const credits = unmatched.filter((tx) => tx.type === 'CREDIT');

    const debitMonths = groupTransactionsByMonth(debits);
    const creditMonths = groupTransactionsByMonth(credits);
    const totalMonths = debitMonths.length + creditMonths.length;

    const [categories, incomeSources] = await Promise.all([
      prisma.expenseCategory.findMany({
        where: { isActive: true },
      }),
      prisma.incomeSource.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { name: true },
      }),
    ]);

    if (!categories.length) {
      return new Response(
        JSON.stringify({ error: 'No expense categories configured' }),
        { status: 400 },
      );
    }

    const encoder = new TextEncoder();
    let processed = 0;
    let totalLlmTokens = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Pre-emitted matched rules — convert rule matches into the same
          // ClassifiedTransaction shape the client expects so pre-matches appear
          // correctly in the review UI (llmCategory & confirmedCategory).
          for (const [month, monthTransactions] of groupTransactionsByMonth(
            matched.map((m) => m.tx),
          )) {
            // Partition pre-matched transactions by type so we emit the correct
            // SSE event type the client expects (`debit_classified` vs `credit_classified`).
            const debitTx = monthTransactions.filter((t) => t.type === 'DEBIT');
            const creditTx = monthTransactions.filter(
              (t) => t.type === 'CREDIT',
            );

            if (debitTx.length > 0) {
              const classified = debitTx.map((tx) => {
                const ann = annotations.get(tx.id)!;
                const matchedRule = rules.find(
                  (r) => r.id === ann.appliedRuleId,
                );
                return {
                  id: tx.id,
                  date: normalizeDateToISO(tx.date, dateFormat),
                  description: tx.description,
                  amount: tx.amount,
                  balance: tx.balance,
                  // Client expects `llmCategory` + `confirmedCategory` fields
                  llmCategory: ann.matchedCategory,
                  confirmedCategory: ann.matchedCategory,
                  overridden: false,
                  // preserve provenance for later DB persistence
                  preMatch: {
                    ruleId: ann.appliedRuleId,
                    category: ann.matchedCategory,
                    ruleName: matchedRule?.name ?? null,
                    matchType: ann.matchType,
                  },
                  sourceHint: 'RULE_MATCH' as const,
                  type: 'DEBIT' as const,
                };
              });
              controller.enqueue(
                sseEvent(encoder, {
                  type: 'debit_classified',
                  month,
                  transactions: classified as ClassifiedTransactionV2[],
                  usage: {
                    totalTokens: 0,
                    promptTokens: 0,
                    completionTokens: 0,
                  },
                }),
              );
            }

            if (creditTx.length > 0) {
              const classified = creditTx.map((tx) => {
                const ann = annotations.get(tx.id)!;
                const matchedRule = rules.find(
                  (r) => r.id === ann.appliedRuleId,
                );
                return {
                  id: tx.id,
                  date: normalizeDateToISO(tx.date, dateFormat),
                  description: tx.description,
                  amount: tx.amount,
                  balance: tx.balance,
                  // Client expects `llmCategory` + `confirmedCategory` fields
                  llmCategory: ann.matchedCategory,
                  confirmedCategory: ann.matchedCategory,
                  overridden: false,
                  // preserve provenance for later DB persistence
                  preMatch: {
                    ruleId: ann.appliedRuleId,
                    category: ann.matchedCategory,
                    ruleName: matchedRule?.name ?? null,
                    matchType: ann.matchType,
                  },
                  sourceHint: 'RULE_MATCH' as const,
                  type: 'CREDIT' as const,
                };
              });
              controller.enqueue(
                sseEvent(encoder, {
                  type: 'credit_classified',
                  month,
                  transactions: classified as any,
                  usage: {
                    totalTokens: 0,
                    promptTokens: 0,
                    completionTokens: 0,
                  },
                }),
              );
            }
          }

          for (const [month, monthTransactions] of debitMonths) {
            try {
              controller.enqueue(
                sseEvent(encoder, {
                  type: 'progress',
                  month,
                  processed: ++processed,
                  total: totalMonths,
                }),
              );

              const result = await classifyTransactions(
                monthTransactions,
                categories,
                dateFormat,
              );
              totalLlmTokens += result.usage.totalTokens;
              totalPromptTokens += result.usage.promptTokens;
              totalCompletionTokens += result.usage.completionTokens;

              const duplicates = await findDuplicatesForClassifiedMonths({
                prisma,
                userId: session.user.id,
                bankAccountId,
                classifiedMonths: [{ month, transactions: result.classified }],
              });

              controller.enqueue(
                sseEvent(encoder, {
                  type: 'debit_classified',
                  month,
                  transactions: result.classified.map((transaction) => ({
                    ...transaction,
                    type: 'DEBIT' as const,
                    sourceHint: 'LLM_SUGGESTED' as const,
                  })) as ClassifiedTransactionV2[],
                  duplicates,
                  usage: result.usage,
                }),
              );
            } catch (monthError: unknown) {
              controller.enqueue(
                sseEvent(encoder, {
                  type: 'warning',
                  month,
                  message:
                    monthError instanceof Error
                      ? monthError.message
                      : `Error classifying month ${month}`,
                }),
              );
            }
          }

          for (const [month, monthTransactions] of creditMonths) {
            try {
              controller.enqueue(
                sseEvent(encoder, {
                  type: 'progress',
                  month,
                  processed: ++processed,
                  total: totalMonths,
                }),
              );

              const result = await classifyCreditTransactions(
                monthTransactions,
                dateFormat,
                incomeSources.map((s) => s.name),
              );
              totalLlmTokens += result.usage.totalTokens;
              totalPromptTokens += result.usage.promptTokens;
              totalCompletionTokens += result.usage.completionTokens;

              controller.enqueue(
                sseEvent(encoder, {
                  type: 'credit_classified',
                  month,
                  transactions: result.classified.map((tx) => ({
                    ...tx,
                    sourceHint: 'LLM_SUGGESTED' as const,
                  })) as ClassifiedCreditTransaction[],
                  usage: result.usage,
                }),
              );
            } catch (monthError: unknown) {
              controller.enqueue(
                sseEvent(encoder, {
                  type: 'warning',
                  month,
                  message:
                    monthError instanceof Error
                      ? monthError.message
                      : `Error classifying month ${month}`,
                }),
              );
            }
          }

          if (totalLlmTokens > 0) {
            await prisma.aIUsageLog.create({
              data: {
                userId: session.user.id,
                sessionId: fileId,
                model: process.env.AI_CLASSIFIER_MODEL ?? 'gpt-4o-mini',
                importType: 'EXPENSE',
                promptTokens: totalPromptTokens,
                completionTokens: totalCompletionTokens,
                totalTokens: totalLlmTokens,
                estimatedCostUSD:
                  (totalPromptTokens / 1_000_000) * 0.15 +
                  (totalCompletionTokens / 1_000_000) * 0.6,
                imageId: null,
              },
            });
          }

          controller.enqueue(
            sseEvent(encoder, {
              type: 'done',
              totalLlmTokens,
              model: process.env.AI_CLASSIFIER_MODEL ?? 'gpt-4o-mini',
              categories: categories.map((category) => ({
                id: category.id,
                name: category.name,
              })),
              incomeSourceLabels: [
                ...incomeSources.map((s) => s.name),
                'Transfer',
                'Excluded',
              ],
            }),
          );

          controller.close();
        } catch (error: unknown) {
          controller.enqueue(
            sseEvent(encoder, {
              type: 'error',
              message: error instanceof Error ? error.message : 'Unknown error',
            }),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: unknown) {
    console.error('CSV classify error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
    });
  }
}
