import { Prisma, TransactionSourceEnum, TransactionStatusEnum, TransactionTypeEnum } from '@prisma/client';
import { z } from 'zod';
import { REIMBURSEMENT_CATEGORY, TRANSFER_CATEGORY } from '@/server/services/transactions/constants';

export interface TransactionRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: TransactionTypeEnum;
  category: string;
  source: TransactionSourceEnum;
  status: TransactionStatusEnum;
  confirmedAt: string | null;
  bankAccountId: string | null;
  bankAccountName: string | null;
  bankName: string | null;
  offsetCategory: string | null;
  offsetTransactionId: string | null;
  reimbursements: TransactionRow[];
  isDonationLinked?: boolean;
  isZakatLinked?: boolean;
  transferLinkedTransactionId: string | null;
  transferCounterpartId: string | null;
  transferCounterpart: {
    id: string;
    date: string;
    description: string;
    amount: number;
    type: string;
    bankAccountName: string | null;
    bankName: string | null;
  } | null;
  isTransferClassified: boolean;
  importSource?: {
    id: string;
    createdAt: string;
  };
}

export interface GetAllOutput {
  transactions: TransactionRow[];
  nextCursor: string | null;
  totalDebitAmount: number;
  totalCreditAmount: number;
}

export interface GetFilterOptionsOutput {
  expenseCategories: Array<{ id: string; name: string }>;
  incomeSourceLabels: Array<{ id: string; name: string }>;
}

export const getAllInputSchema = z.object({
  cursor: z.string().cuid().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  type: z.nativeEnum(TransactionTypeEnum).optional(),
  status: z.nativeEnum(TransactionStatusEnum).optional(),
  bankAccountId: z.string().optional(),
  category: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  uncategorized: z.boolean().optional(),
  reimbursementOnly: z.boolean().optional(),
  amountMin: z.number().nonnegative().optional(),
  amountMax: z.number().nonnegative().optional(),
  transferOnly: z.boolean().optional(),
  unmatchedTransferOnly: z.boolean().optional(),
  excludeTransferCategory: z.boolean().optional(),
  ids: z.array(z.string()).optional(), 
});

export function buildTransactionWhere(
  input: z.infer<typeof getAllInputSchema>,
  userId: string,
) {
  if (input.ids?.length) {
    return {
      userId,
      id: { in: input.ids },
    } satisfies Prisma.TransactionWhereInput;
  }

  const where: Prisma.TransactionWhereInput = { userId };
  where.status = { not: TransactionStatusEnum.VOIDED };

  if (input.type) where.type = input.type;
  if (input.status) where.status = input.status;
  if (input.bankAccountId) where.bankAccountId = input.bankAccountId;
  if (input.category) where.category = input.category;
  if (input.uncategorized === true) where.category = '';
  if (input.reimbursementOnly === true) where.category = REIMBURSEMENT_CATEGORY;
  if (input.transferOnly === true) where.category = TRANSFER_CATEGORY;
  if (input.unmatchedTransferOnly === true) {
    where.category = TRANSFER_CATEGORY;
    // @ts-ignore
    where.transferLinkedTransactionId = null;
    // @ts-ignore
    where.transferCounterpart = { is: null };
  }

  if (input.excludeTransferCategory === true && !input.category) {
    where.category = { not: TRANSFER_CATEGORY };
  }

  if (input.dateFrom || input.dateTo) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (input.dateFrom) dateFilter.gte = new Date(`${input.dateFrom}T00:00:00`);
    if (input.dateTo) {
      const end = new Date(`${input.dateTo}T00:00:00`);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }
    where.date = dateFilter;
  }

  if (input.amountMin !== undefined || input.amountMax !== undefined) {
    const amountFilter: Prisma.DecimalFilter = {};
    if (input.amountMin !== undefined) amountFilter.gte = input.amountMin;
    if (input.amountMax !== undefined) amountFilter.lte = input.amountMax;
    where.amount = amountFilter;
  }

  if (input.search?.trim()) {
    const search = input.search.trim();
    where.OR = [
      { description: { contains: search, mode: 'insensitive' } },
      { category: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (
    input.status === TransactionStatusEnum.CONFIRMED &&
    !input.transferOnly &&
    !input.unmatchedTransferOnly &&
    !input.reimbursementOnly &&
    !input.category &&
    !input.uncategorized
  ) {
    where.category = { not: TRANSFER_CATEGORY };
  }

  return where;
}
