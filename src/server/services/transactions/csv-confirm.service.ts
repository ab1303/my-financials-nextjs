import {
  TransactionSourceEnum,
  TransactionStatusEnum,
  TransactionTypeEnum,
} from '@prisma/client';

import { prisma } from '@/server/db/client';
import type { ClassifiedCreditTransaction, ClassifiedTransactionV2 } from '@/server/services/ai-import/_types';

import { buildDedupSet, getDateRangeFromMonthKeys, isDuplicate, makeDedupKey } from './dedup.service';
import type { CreditMonth, DebitMonth, TransactionSaveResult } from './_types';
import { EXCLUDED_CREDIT_LABELS, EXCLUDED_DEBIT_LABELS } from './constants';

function createEmptyResult(): TransactionSaveResult {
  return {
    savedMonths: 0,
    totalEntries: 0,
    duplicatesSkipped: 0,
    errors: [],
  };
}

function parseMonthKey(monthKey: string): { year: number; monthNum: number } {
  const [yearStr, monthStr] = monthKey.split('-');
  return {
    year: Number.parseInt(yearStr ?? '', 10),
    monthNum: Number.parseInt(monthStr ?? '', 10),
  };
}

async function getFiscalCalendarYear(_year: number, _monthNum: number) {
  return prisma.calendarYear.findFirst({
    where: { type: 'FISCAL' },
  });
}

async function getOrCreateExpenseLedger(calendarYearId: string, userId: string) {
  let ledger = await prisma.expenseLedger.findUnique({
    where: { calendarId_userId: { calendarId: calendarYearId, userId } },
  });

  if (!ledger) {
    ledger = await prisma.expenseLedger.create({
      data: { calendarId: calendarYearId, userId },
    });
  }

  return ledger;
}

async function getOrCreateIncomeLedger(calendarYearId: string, userId: string) {
  let ledger = await prisma.incomeLedger.findUnique({
    where: { calendarId_userId: { calendarId: calendarYearId, userId } },
  });

  if (!ledger) {
    ledger = await prisma.incomeLedger.create({
      data: { calendarId: calendarYearId, userId },
    });
  }

  return ledger;
}


function resolveIncomeSourceId(
  categoryName: string,
  allSources: Array<{ id: string; name: string }>,
): string {
  const match = allSources.find((s) => s.name.toLowerCase() === categoryName.toLowerCase());
  if (match) return match.id;
  const other = allSources.find((s) => s.name === 'Other');
  return other?.id ?? allSources[0]!.id;
}

async function upsertMonthlyExpenseSummary(params: {
  ledgerId: string;
  categoryId: string;
  monthNum: number;
  amount: number;
}) {
  const existing = await prisma.monthlyExpenseSummary.findFirst({
    where: {
      expenseLedgerId: params.ledgerId,
      categoryId: params.categoryId,
      month: params.monthNum,
    },
  });

  if (existing) {
    await prisma.monthlyExpenseSummary.update({
      where: { id: existing.id },
      data: { amount: { increment: params.amount } },
    });
    return;
  }

  await prisma.monthlyExpenseSummary.create({
    data: {
      month: params.monthNum,
      amount: params.amount,
      categoryId: params.categoryId,
      expenseLedgerId: params.ledgerId,
    },
  });
}

async function createTransactionRecord(params: {
  date: string;
  description: string;
  amount: number;
  type: TransactionTypeEnum;
  category: string;
  status: TransactionStatusEnum;
  userId: string;
  bankAccountId: string;
  importSessionId: string;
  source: TransactionSourceEnum;
  runningBalance?: number;
}) {
  await prisma.transaction.create({
    data: {
      date: new Date(params.date),
      description: params.description,
      amount: params.amount,
      type: params.type,
      category: params.category,
      source: params.source,
      status: params.status,
      confirmedAt: new Date(),
      userId: params.userId,
      bankAccountId: params.bankAccountId,
      importSessionId: params.importSessionId,
      runningBalance: params.runningBalance ?? null,
    },
  });
}

/**
 * Confirm debit transactions: upsert ExpenseLedger → upsert MonthlyExpenseSummary → create Transaction audit record.
 */
export async function confirmDebitTransactions(
  debitMonths: DebitMonth[],
  userId: string,
  bankAccountId: string,
  importSessionId: string,
): Promise<TransactionSaveResult> {
  const result = createEmptyResult();

  const monthKeys = debitMonths.map((m) => m.month);
  if (monthKeys.length === 0) return result;
  const { startDate, endDate } = getDateRangeFromMonthKeys(monthKeys);
  const dedupSet = await buildDedupSet({ userId, bankAccountId, startDate, endDate });

  const categories = await prisma.expenseCategory.findMany({ where: { isActive: true } });
  const categoryMap = new Map(categories.map((category) => [category.name.toLowerCase(), category.id]));

  // Get or create "Other" category for unmapped transactions
  let otherCategoryId = categoryMap.get('other');
  if (!otherCategoryId) {
    const otherCategory = categories.find((c) => c.name.toLowerCase() === 'other');
    if (otherCategory) {
      otherCategoryId = otherCategory.id;
      categoryMap.set('other', otherCategoryId);
    } else {
      // Create "Other" category if it doesn't exist
      const created = await prisma.expenseCategory.create({
        data: { name: 'Other', isActive: true },
      });
      otherCategoryId = created.id;
      categoryMap.set('other', otherCategoryId);
    }
  }

  for (const { month: monthKey, transactions } of debitMonths) {
    try {
      const { year, monthNum } = parseMonthKey(monthKey);
      const calendarYear = await getFiscalCalendarYear(year, monthNum);

      if (!calendarYear) {
        result.errors.push({ month: monthKey, message: `No fiscal year found for ${monthKey}` });
        continue;
      }

      const ledger = await getOrCreateExpenseLedger(calendarYear.id, userId);

      for (const tx of transactions as ClassifiedTransactionV2[]) {
        const dedupKey = makeDedupKey({
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          type: 'DEBIT',
          runningBalance: tx.balance ?? null,
        });
        if (isDuplicate(dedupKey, dedupSet)) {
          result.duplicatesSkipped += 1;
          continue;
        }

        // Guard: Transfer debits are saved as EXCLUDED — no expense rollup
        const isTransferDebit = (EXCLUDED_DEBIT_LABELS as readonly string[]).includes(tx.confirmedCategory);

        if (isTransferDebit) {
          await createTransactionRecord({
            date: tx.date,
            description: tx.description,
            amount: tx.amount,
            type: TransactionTypeEnum.DEBIT,
            category: tx.confirmedCategory,
            source: tx.overridden ? TransactionSourceEnum.USER_OVERRIDE : TransactionSourceEnum.LLM_CLASSIFIED,
            status: TransactionStatusEnum.EXCLUDED,
            userId,
            bankAccountId,
            importSessionId,
            runningBalance: tx.balance,
          });
          result.totalEntries += 1;
          dedupSet.add(dedupKey);
          continue;
        }

        // Try to find category; fallback to "Other" if not found (instead of silently skipping)
        let categoryId = categoryMap.get(tx.confirmedCategory.toLowerCase());
        if (!categoryId) {
          categoryId = otherCategoryId;
        }

        await upsertMonthlyExpenseSummary({
          ledgerId: ledger.id,
          categoryId,
          monthNum,
          amount: tx.amount,
        });

        await createTransactionRecord({
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          type: TransactionTypeEnum.DEBIT,
          category: tx.confirmedCategory,
          source: tx.overridden ? TransactionSourceEnum.USER_OVERRIDE : TransactionSourceEnum.LLM_CLASSIFIED,
          status: TransactionStatusEnum.CONFIRMED,
          userId,
          bankAccountId,
          importSessionId,
          runningBalance: tx.balance,
        });

        await prisma.merchantCategoryMap.upsert({
          where: {
            userId_description: {
              userId,
              description: tx.description.toLowerCase().trim(),
            },
          },
          update: {
            category: tx.confirmedCategory,
            source: tx.overridden ? 'user_override' : 'llm_confirmed',
          },
          create: {
            userId,
            description: tx.description.toLowerCase().trim(),
            category: tx.confirmedCategory,
            source: tx.overridden ? 'user_override' : 'llm_confirmed',
          },
        });

        result.totalEntries += 1;
        dedupSet.add(dedupKey);
      }

      result.savedMonths += 1;
    } catch (error: unknown) {
      result.errors.push({
        month: monthKey,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

/**
 * Confirm credit transactions: route to IncomeLedger+IncomeRecord (income) or EXCLUDED Transaction only.
 */
export async function confirmCreditTransactions(
  creditMonths: CreditMonth[],
  userId: string,
  bankAccountId: string,
  importSessionId: string,
): Promise<TransactionSaveResult> {
  const result = createEmptyResult();

  const monthKeys = creditMonths.map((m) => m.month);
  if (monthKeys.length === 0) return result;
  const { startDate, endDate } = getDateRangeFromMonthKeys(monthKeys);
  const dedupSet = await buildDedupSet({ userId, bankAccountId, startDate, endDate });

  const allIncomeSources = await prisma.incomeSource.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  for (const { month: monthKey, transactions } of creditMonths) {
    try {
      const { year, monthNum } = parseMonthKey(monthKey);
      const calendarYear = await getFiscalCalendarYear(year, monthNum);

      if (!calendarYear) {
        result.errors.push({ month: monthKey, message: `No fiscal year found for ${monthKey}` });
        continue;
      }

      for (const tx of transactions as ClassifiedCreditTransaction[]) {
        const dedupKey = makeDedupKey({
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          type: 'CREDIT',
          runningBalance: tx.balance ?? null,
        });
        if (isDuplicate(dedupKey, dedupSet)) {
          result.duplicatesSkipped += 1;
          continue;
        }

        const isExcluded = (EXCLUDED_CREDIT_LABELS as readonly string[]).includes(tx.confirmedCategory);

        if (isExcluded) {
          await createTransactionRecord({
            date: tx.date,
            description: tx.description,
            amount: tx.amount,
            type: TransactionTypeEnum.CREDIT,
            category: tx.confirmedCategory,
            source: tx.overridden ? TransactionSourceEnum.USER_OVERRIDE : TransactionSourceEnum.LLM_CLASSIFIED,
            status: TransactionStatusEnum.EXCLUDED,
            userId,
            bankAccountId,
            importSessionId,
            runningBalance: tx.balance,
          });
        } else {
          const incomeLedger = await getOrCreateIncomeLedger(calendarYear.id, userId);

          await prisma.incomeRecord.create({
            data: {
              dateEarned: new Date(tx.date),
              amount: String(tx.amount),
              incomeSourceId: resolveIncomeSourceId(tx.confirmedCategory, allIncomeSources),
              incomeLedgerId: incomeLedger.id,
            },
          });

          await createTransactionRecord({
            date: tx.date,
            description: tx.description,
            amount: tx.amount,
            type: TransactionTypeEnum.CREDIT,
            category: tx.confirmedCategory,
            source: tx.overridden ? TransactionSourceEnum.USER_OVERRIDE : TransactionSourceEnum.LLM_CLASSIFIED,
            status: TransactionStatusEnum.CONFIRMED,
            userId,
            bankAccountId,
            importSessionId,
            runningBalance: tx.balance,
          });
        }

        result.totalEntries += 1;
        dedupSet.add(dedupKey);
      }

      result.savedMonths += 1;
    } catch (error: unknown) {
      result.errors.push({
        month: monthKey,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}
