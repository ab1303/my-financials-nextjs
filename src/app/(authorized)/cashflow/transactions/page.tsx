import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';

import TransactionsClient from './_components/TransactionsClient';

export const metadata: Metadata = {
  title: 'Transactions',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TransactionsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');

  const bankAccountRecords = await prisma.financialAccount.findMany({
    where: { userId: session.user.id },
    include: { institution: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const bankAccounts = bankAccountRecords.map((a) => ({
    id: a.id,
    name: a.name,
    bankName: a.institution?.name ?? 'Unknown Bank',
  }));

  const resolvedSearchParams = await searchParams;
  const initialCategory = resolvedSearchParams.category
    ? decodeURIComponent(resolvedSearchParams.category as string)
    : undefined;
  const initialMonth = resolvedSearchParams.month ? Number.parseInt(resolvedSearchParams.month as string, 10) : undefined;
  const initialYear = resolvedSearchParams.year ? Number.parseInt(resolvedSearchParams.year as string, 10) : undefined;

  return (
    <TransactionsClient
      bankAccounts={bankAccounts}
      initialCategory={initialCategory}
      initialMonth={initialMonth}
      initialYear={initialYear}
    />
  );
}
