import { TransactionTypeEnum } from '@prisma/client';
import { protectedProcedure } from '@/server/trpc/trpc';
import { getAllInputSchema, buildTransactionWhere, GetAllOutput, TransactionRow } from '../shared';
import { REIMBURSEMENT_CATEGORY, TRANSFER_CATEGORY } from '@/server/services/transactions/constants';

export const getAllQuery = protectedProcedure
  .input(getAllInputSchema)
  .query(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const where = buildTransactionWhere(input, userId);

    const [rows, debitAggregate, creditAggregate] = await Promise.all([
      ctx.prisma.transaction.findMany({
        where,
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        skip: input.cursor ? 1 : 0,
        include: {
          financialAccount: {
            select: { name: true, institution: { select: { name: true } } },
          },
          reimbursements: {
            where: { category: REIMBURSEMENT_CATEGORY },
            select: {
              id: true,
              date: true,
              description: true,
              amount: true,
              type: true,
              category: true,
              offsetCategory: true,
              source: true,
              status: true,
              confirmedAt: true,
              bankAccountId: true,
              financialAccount: {
                select: {
                  name: true,
                  institution: { select: { name: true } },
                },
              },
            },
          },
          zakatPayment: { select: { id: true } },
          voluntaryDonations: { select: { id: true } },
          interestCleansingEvidence: { select: { id: true } },
          transferLinkedTransaction: {
            select: {
              id: true,
              date: true,
              description: true,
              amount: true,
              type: true,
              financialAccount: {
                select: {
                  name: true,
                  institution: { select: { name: true } },
                },
              },
            },
          },
          transferCounterpart: {
            select: {
              id: true,
              date: true,
              description: true,
              amount: true,
              type: true,
              financialAccount: {
                select: {
                  name: true,
                  institution: { select: { name: true } },
                },
              },
            },
          },
          importSession: { select: { id: true, createdAt: true } },
        },
      }),
      ctx.prisma.transaction.aggregate({
        where: { ...where, type: TransactionTypeEnum.DEBIT },
        _sum: { amount: true },
      }),
      ctx.prisma.transaction.aggregate({
        where: { ...where, type: TransactionTypeEnum.CREDIT },
        _sum: { amount: true },
      }),
    ]);

    const hasNextPage = rows.length > input.limit;
    const transactions = hasNextPage ? rows.slice(0, input.limit) : rows;
    const nextCursor = hasNextPage
      ? (transactions[transactions.length - 1]?.id ?? null)
      : null;

    const outputTransactions: TransactionRow[] = (
      transactions as any[]
    ).map((tx) => ({
      id: tx.id,
      date: tx.date.toISOString(),
      description: tx.description,
      amount: Number(tx.amount),
      type: tx.type,
      category: tx.category,
      source: tx.source,
      status: tx.status,
      confirmedAt: tx.confirmedAt ? tx.confirmedAt.toISOString() : null,
      bankAccountId: tx.bankAccountId,
      bankAccountName: tx.financialAccount?.name ?? null,
      bankName: tx.financialAccount?.institution?.name ?? null,
      offsetCategory: tx.offsetCategory ?? null,
      offsetTransactionId: tx.offsetTransactionId ?? null,
      reimbursements: (tx.reimbursements ?? []).map((r: any) => ({
        id: r.id,
        date: r.date.toISOString(),
        description: r.description,
        amount: Number(r.amount),
        type: r.type,
        category: r.category,
        offsetCategory: r.offsetCategory ?? null,
        source: r.source,
        status: r.status,
        confirmedAt: r.confirmedAt ? r.confirmedAt.toISOString() : null,
        bankAccountId: r.bankAccountId,
        bankAccountName: r.financialAccount?.name ?? null,
        bankName: r.financialAccount?.institution?.name ?? null,
        offsetTransactionId: null,
        reimbursements: [],
        transferLinkedTransactionId: null,
        transferCounterpartId: null,
        transferCounterpart: null,
        isTransferClassified: false,
      })),
      isDonationLinked:
        tx.category.toLowerCase() === 'gifts & donations' &&
        tx.type === TransactionTypeEnum.DEBIT
          ? tx.voluntaryDonations.length > 0
          : undefined,
      isZakatLinked:
        tx.category.toLowerCase() === 'gifts & donations' &&
        tx.type === TransactionTypeEnum.DEBIT
          ? tx.zakatPayment !== null
          : undefined,
      isInterestLinked:
        tx.category.toLowerCase() === 'gifts & donations' &&
        tx.type === TransactionTypeEnum.DEBIT
          ? tx.interestCleansingEvidence.length > 0
          : undefined,
      transferLinkedTransactionId: tx.transferLinkedTransactionId ?? null,
      transferCounterpartId: tx.transferCounterpart?.id ?? null,
      transferCounterpart: (() => {
        const raw =
          tx.transferLinkedTransaction ??
          tx.transferCounterpart ??
          null;
        if (!raw) return null;
        return {
          id: raw.id,
          date: (raw.date as Date).toISOString(),
          description: raw.description as string,
          amount: Number(raw.amount),
          type: raw.type as string,
          bankAccountName: raw.financialAccount?.name ?? null,
          bankName: raw.financialAccount?.institution?.name ?? null,
        };
      })(),
      isTransferClassified: tx.category === TRANSFER_CATEGORY,
      importSource: tx.importSession
        ? {
            id: tx.importSession.id,
            createdAt: tx.importSession.createdAt.toISOString(),
          }
        : undefined,
    }));

    return {
      transactions: outputTransactions,
      nextCursor,
      totalDebitAmount: Number(debitAggregate._sum.amount ?? 0),
      totalCreditAmount: Number(creditAggregate._sum.amount ?? 0),
    } satisfies GetAllOutput;
  });
