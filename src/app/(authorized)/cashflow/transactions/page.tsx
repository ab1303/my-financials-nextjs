import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';

import TransactionsClient from './_components/TransactionsClient';

export const metadata: Metadata = {
  title: 'Transactions',
};

export default async function TransactionsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');

  const bankAccountRecords = await prisma.bankAccount.findMany({
    where: { userId: session.user.id },
    include: { bank: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const bankAccounts = bankAccountRecords.map((a) => ({
    id: a.id,
    name: a.name,
    bankName: a.bank?.name ?? 'Unknown Bank',
  }));

  return <TransactionsClient bankAccounts={bankAccounts} />;
}