import {
  TransactionSourceEnum,
  TransactionStatusEnum,
  TransactionTypeEnum,
} from '@prisma/client';

import { prisma } from '@/server/db/client';
import type {
  ClassifiedCreditTransaction,
  ClassifiedTransactionV2,
} from '@/server/services/ai-import/_types';

import type { CreditMonth, DebitMonth, TransactionSaveResult } from './_types';
import {
  EXCLUDED_CREDIT_LABELS,
  EXCLUDED_FROM_EXPENSE_AGGREGATION,
} from './constants';
import {
  buildDedupSet,
  getDateRangeFromMonthKeys,
  isDuplicate,
  makeDedupKey,
} from './dedup.service';

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

async function getOrCreateExpenseLedger(
  calendarYearId: string,
  userId: string,
) {
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
  appliedRuleId?: string;
}): Promise<string> {
  const tx = await prisma.transaction.create({
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
      // NOTE: provenance persistence (appliedRuleId) is Phase 2. Do not write
      // `metadata` to the `transaction` table in Phase 1 — schema currently
      // lacks a JSON `metadata` column. Keep `appliedRuleId` in the signature
      // for future Phase 2 migration, but do not persist it here.
    },
    select: { id: true },
  });
  return tx.id;
}

/**
 * Confirm debit transactions: upsert ExpenseLedger → upsert MonthlyExpenseSummary → create Transaction audit record.
 */
export async function confirmDebitTransactions(
  debitMonths: DebitMonth[],
  userId: string,
  bankAccountId: string,
  importSessionId: string,
  forceCreateIds?: string[],
): Promise<TransactionSaveResult> {
  const result = createEmptyResult();

  const monthKeys = debitMonths.map((m) => m.month);
  if (monthKeys.length === 0) return result;
  const { startDate, endDate } = getDateRangeFromMonthKeys(monthKeys);
  const dedupSet = await buildDedupSet({
    userId,
    bankAccountId,
    startDate,
    endDate,
  });

  const categories = await prisma.expenseCategory.findMany({
    where: { isActive: true },
  });
  const categoryMap = new Map(
    categories.map((category) => [category.name.toLowerCase(), category.id]),
  );

  // Get or create "Other" category for unmapped transactions
  let otherCategoryId = categoryMap.get('other');
  if (!otherCategoryId) {
    const otherCategory = categories.find(
      (c) => c.name.toLowerCase() === 'other',
    );
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
        result.errors.push({
          month: monthKey,
          message: `No fiscal year found for ${monthKey}`,
        });
        continue;
      }

      const ledger = await getOrCreateExpenseLedger(calendarYear.id, userId);

      for (const tx of transactions as ClassifiedTransactionV2[]) {
        try {
          const dedupKey = makeDedupKey({
            date: tx.date,
            description: tx.description,
            amount: tx.amount,
            type: 'DEBIT',
            runningBalance: tx.balance ?? null,
          });
          const isForced = forceCreateIds?.includes(tx.id);
          if (isDuplicate(dedupKey, dedupSet) && !isForced) {
            result.duplicatesSkipped += 1;
            continue;
          }

          // Guard: categories in EXCLUDED_FROM_EXPENSE_AGGREGATION are saved as EXCLUDED — no expense rollup
          const isTransferDebit = (
            EXCLUDED_FROM_EXPENSE_AGGREGATION as readonly string[]
          ).includes(tx.confirmedCategory);

          // Determine source and provenance
          const source =
            tx.sourceHint === 'RULE_MATCH'
              ? TransactionSourceEnum.USER_OVERRIDE
              : tx.overridden
                ? TransactionSourceEnum.USER_OVERRIDE
                : TransactionSourceEnum.LLM_CLASSIFIED;
          const appliedRuleId = tx.preMatch?.ruleId;

          if (isTransferDebit) {
            await createTransactionRecord({
              date: tx.date,
              description: tx.description,
              amount: tx.amount,
              type: TransactionTypeEnum.DEBIT,
              category: tx.confirmedCategory,
              source,
              status: TransactionStatusEnum.EXCLUDED,
              userId,
              bankAccountId,
              importSessionId,
              runningBalance: tx.balance,
              appliedRuleId,
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
            source,
            status: TransactionStatusEnum.CONFIRMED,
            userId,
            bankAccountId,
            importSessionId,
            runningBalance: tx.balance,
            appliedRuleId,
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
              source:
                source === TransactionSourceEnum.USER_OVERRIDE
                  ? 'user_override'
                  : 'llm_confirmed',
            },
            create: {
              userId,
              description: tx.description.toLowerCase().trim(),
              category: tx.confirmedCategory,
              source:
                source === TransactionSourceEnum.USER_OVERRIDE
                  ? 'user_override'
                  : 'llm_confirmed',
            },
          });

          result.totalEntries += 1;
          dedupSet.add(dedupKey);
        } catch (txErr: unknown) {
          const msg = txErr instanceof Error ? txErr.message : String(txErr);
          console.error('[csv-confirm] tx error (debit)', {
            month: monthKey,
            error: msg,
          });
          result.errors.push({ month: monthKey, message: msg });
          continue;
        }
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
 * Confirm credit transactions: create Transaction records (type=CREDIT) as the income source of truth.
 * Income Tracking page queries Transaction directly — no IncomeRecord is created.
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
  const dedupSet = await buildDedupSet({
    userId,
    bankAccountId,
    startDate,
    endDate,
  });

  for (const { month: monthKey, transactions } of creditMonths) {
    try {
      const { year, monthNum } = parseMonthKey(monthKey);
      const calendarYear = await getFiscalCalendarYear(year, monthNum);

      if (!calendarYear) {
        result.errors.push({
          month: monthKey,
          message: `No fiscal year found for ${monthKey}`,
        });
        continue;
      }

      for (const tx of transactions as ClassifiedCreditTransaction[]) {
        try {
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

          const isExcluded = (
            EXCLUDED_CREDIT_LABELS as readonly string[]
          ).includes(tx.confirmedCategory);

          // Determine source and provenance
          const source =
            tx.sourceHint === 'RULE_MATCH'
              ? TransactionSourceEnum.USER_OVERRIDE
              : tx.overridden
                ? TransactionSourceEnum.USER_OVERRIDE
                : TransactionSourceEnum.LLM_CLASSIFIED;
          const appliedRuleId = tx.preMatch?.ruleId;

          if (isExcluded) {
            await createTransactionRecord({
              date: tx.date,
              description: tx.description,
              amount: tx.amount,
              type: TransactionTypeEnum.CREDIT,
              category: tx.confirmedCategory,
              source,
              status: TransactionStatusEnum.EXCLUDED,
              userId,
              bankAccountId,
              importSessionId,
              runningBalance: tx.balance,
              appliedRuleId,
            });
          } else {
            // Create Transaction record — income view queries Transaction directly (source of truth).
            await createTransactionRecord({
              date: tx.date,
              description: tx.description,
              amount: tx.amount,
              type: TransactionTypeEnum.CREDIT,
              category: tx.confirmedCategory,
              source,
              status: TransactionStatusEnum.CONFIRMED,
              userId,
              bankAccountId,
              importSessionId,
              runningBalance: tx.balance,
              appliedRuleId,
            });
          }

          result.totalEntries += 1;
          dedupSet.add(dedupKey);
        } catch (txErr: unknown) {
          const msg = txErr instanceof Error ? txErr.message : String(txErr);
          console.error('[csv-confirm] tx error (credit)', {
            month: monthKey,
            error: msg,
          });
          result.errors.push({ month: monthKey, message: msg });
          continue;
        }
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
