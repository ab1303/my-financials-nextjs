import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';

import TransactionsClient from './_components/TransactionsClient';
import TransactionsUnavailable from './TransactionsUnavailable';

export const metadata: Metadata = {
  title: 'Transactions',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TransactionsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');

  let bankAccounts: Array<{ id: string; name: string; bankName: string }> = [];
  let initialCategory: string | undefined;
  let initialCategoryId: string | undefined;
  let initialDateFrom: string | undefined;
  let initialDateTo: string | undefined;
  let initialMonth: number | undefined;
  let initialYear: number | undefined;
  let viewMode: string | undefined;
  let initialTab: string | undefined;

  try {
    const bankAccountRecords = await prisma.financialAccount.findMany({
      where: { userId: session.user.id },
      include: { institution: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    bankAccounts = bankAccountRecords.map((a) => ({
      id: a.id,
      name: a.name,
      bankName: a.institution?.name ?? 'Unknown Bank',
    }));

    const resolvedSearchParams = await searchParams;

    // Handle categoryId instead of category name
    const categoryId = resolvedSearchParams.category as string | undefined;

    if (categoryId) {
      // Look up category name from ID
      const category = await prisma.expenseCategory.findUnique({
        where: { id: categoryId },
        select: { name: true },
      });

      if (category) {
        initialCategory = category.name;
        initialCategoryId = categoryId;
      }
    }

    // Also support direct category name (from income breakdown tiles)
    const categoryName = resolvedSearchParams.categoryName as
      | string
      | undefined;
    if (!initialCategory && categoryName) {
      initialCategory = categoryName;
      // No categoryId needed — ledger filters by name directly
    }

    initialDateFrom = resolvedSearchParams.dateFrom as string | undefined;
    initialDateTo = resolvedSearchParams.dateTo as string | undefined;

    initialMonth = resolvedSearchParams.month
      ? Number.parseInt(resolvedSearchParams.month as string, 10)
      : undefined;
    initialYear = resolvedSearchParams.year
      ? Number.parseInt(resolvedSearchParams.year as string, 10)
      : undefined;
    viewMode = resolvedSearchParams.view as string | undefined;
    initialTab = resolvedSearchParams.tab as string | undefined;
  } catch {
    return <TransactionsUnavailable />;
  }

  return (
    <TransactionsClient
      bankAccounts={bankAccounts}
      initialCategory={initialCategory}
      initialCategoryId={initialCategoryId}
      initialMonth={initialMonth}
      initialYear={initialYear}
      viewMode={viewMode}
      initialTab={initialTab}
      initialDateFrom={initialDateFrom}
      initialDateTo={initialDateTo}
    />
  );
}
