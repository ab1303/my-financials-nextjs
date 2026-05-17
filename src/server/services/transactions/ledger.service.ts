import type { PrismaClient } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';

export async function rerollupExpenseSummary(params: {
  prismaClient: PrismaClient;
  userId: string;
  oldCategory: string;
  newCategory: string;
  amount: Decimal;
  date: Date;
}): Promise<void> {
  const fiscalCalendar = await params.prismaClient.calendarYear.findFirst({
    where: { type: 'FISCAL' },
    select: { id: true },
  });

  if (!fiscalCalendar) {
    return;
  }

  const expenseLedger = await params.prismaClient.expenseLedger.findUnique({
    where: {
      calendarId_userId: {
        calendarId: fiscalCalendar.id,
        userId: params.userId,
      },
    },
    select: { id: true },
  });

  if (!expenseLedger) {
    return;
  }

  const month = params.date.getMonth() + 1;

  const [oldCategory, newCategory] = await Promise.all([
    params.prismaClient.expenseCategory.findFirst({
      where: { name: params.oldCategory, isActive: true },
      select: { id: true },
    }),
    params.prismaClient.expenseCategory.findFirst({
      where: { name: params.newCategory, isActive: true },
      select: { id: true },
    }),
  ]);

  if (oldCategory) {
    await params.prismaClient.monthlyExpenseSummary.updateMany({
      where: {
        expenseLedgerId: expenseLedger.id,
        categoryId: oldCategory.id,
        month,
      },
      data: {
        amount: {
          decrement: params.amount,
        },
      },
    });
  }

  if (!newCategory) {
    return;
  }

  const existingSummary = await params.prismaClient.monthlyExpenseSummary.findFirst({
    where: {
      expenseLedgerId: expenseLedger.id,
      categoryId: newCategory.id,
      month,
    },
    select: { id: true },
  });

  if (existingSummary) {
    await params.prismaClient.monthlyExpenseSummary.update({
      where: { id: existingSummary.id },
      data: {
        amount: {
          increment: params.amount,
        },
      },
    });
    return;
  }

  await params.prismaClient.monthlyExpenseSummary.create({
    data: {
      month,
      amount: params.amount,
      categoryId: newCategory.id,
      expenseLedgerId: expenseLedger.id,
    },
  });
}

export async function updateIncomeRecordSource(params: {
  prismaClient: PrismaClient;
  userId: string;
  newSourceName: string;
  amount: Decimal;
  transactionDate: Date;
}): Promise<void> {
  const fiscalCalendar = await params.prismaClient.calendarYear.findFirst({
    where: { type: 'FISCAL' },
    select: { id: true },
  });

  if (!fiscalCalendar) {
    return;
  }

  const incomeLedger = await params.prismaClient.incomeLedger.findUnique({
    where: {
      calendarId_userId: {
        calendarId: fiscalCalendar.id,
        userId: params.userId,
      },
    },
    select: { id: true },
  });

  if (!incomeLedger) {
    return;
  }

  const incomeRecord = await params.prismaClient.incomeRecord.findFirst({
    where: {
      incomeLedgerId: incomeLedger.id,
      dateEarned: params.transactionDate,
      amount: params.amount.toString(),
    },
    select: { id: true },
  });

  if (!incomeRecord) {
    return;
  }

  const incomeSource = await params.prismaClient.incomeSource.findFirst({
    where: { name: { equals: params.newSourceName, mode: 'insensitive' } },
    select: { id: true },
  });

  if (!incomeSource) {
    return;
  }

  await params.prismaClient.incomeRecord.update({
    where: { id: incomeRecord.id },
    data: {
      incomeSourceId: incomeSource.id,
    },
  });
}

/**
 * Decrements MonthlyExpenseSummary.amount for `offsetCategory` by `amount`.
 * Called when a CREDIT transaction is promoted to Reimbursement.
 * The summary amount can become negative (reimbursed more than spent in the month).
 */
export async function applyReimbursementOffset(params: {
  prismaClient: PrismaClient;
  userId: string;
  offsetCategory: string;
  amount: Decimal;
  date: Date;
}): Promise<void> {
  const fiscalCalendar = await params.prismaClient.calendarYear.findFirst({
    where: { type: 'FISCAL' },
    select: { id: true },
  });
  if (!fiscalCalendar) return;

  const expenseLedger = await params.prismaClient.expenseLedger.findUnique({
    where: { calendarId_userId: { calendarId: fiscalCalendar.id, userId: params.userId } },
    select: { id: true },
  });
  if (!expenseLedger) return;

  const month = params.date.getMonth() + 1;

  const category = await params.prismaClient.expenseCategory.findFirst({
    where: { name: params.offsetCategory, isActive: true },
    select: { id: true },
  });
  if (!category) return;

  await params.prismaClient.monthlyExpenseSummary.updateMany({
    where: { expenseLedgerId: expenseLedger.id, categoryId: category.id, month },
    data: { amount: { decrement: params.amount } },
  });
}

/**
 * Increments MonthlyExpenseSummary.amount for `offsetCategory` by `amount`.
 * Called when a Reimbursement CREDIT is demoted back to EXCLUDED (user removes Reimbursement).
 * Symmetric inverse of applyReimbursementOffset.
 */
export async function reverseReimbursementOffset(params: {
  prismaClient: PrismaClient;
  userId: string;
  offsetCategory: string;
  amount: Decimal;
  date: Date;
}): Promise<void> {
  const fiscalCalendar = await params.prismaClient.calendarYear.findFirst({
    where: { type: 'FISCAL' },
    select: { id: true },
  });
  if (!fiscalCalendar) return;

  const expenseLedger = await params.prismaClient.expenseLedger.findUnique({
    where: { calendarId_userId: { calendarId: fiscalCalendar.id, userId: params.userId } },
    select: { id: true },
  });
  if (!expenseLedger) return;

  const month = params.date.getMonth() + 1;

  const category = await params.prismaClient.expenseCategory.findFirst({
    where: { name: params.offsetCategory, isActive: true },
    select: { id: true },
  });
  if (!category) return;

  const existing = await params.prismaClient.monthlyExpenseSummary.findFirst({
    where: { expenseLedgerId: expenseLedger.id, categoryId: category.id, month },
    select: { id: true },
  });

  if (existing) {
    await params.prismaClient.monthlyExpenseSummary.update({
      where: { id: existing.id },
      data: { amount: { increment: params.amount } },
    });
  } else {
    await params.prismaClient.monthlyExpenseSummary.create({
      data: {
        month,
        amount: params.amount,
        categoryId: category.id,
        expenseLedgerId: expenseLedger.id,
      },
    });
  }
}

