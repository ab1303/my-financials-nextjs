import type { PrismaClient } from '@prisma/client';
import { IncomeSourceEnumType } from '@prisma/client';
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
  newSource: IncomeSourceEnumType;
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

  await params.prismaClient.incomeRecord.update({
    where: { id: incomeRecord.id },
    data: {
      source: params.newSource,
    },
  });
}
