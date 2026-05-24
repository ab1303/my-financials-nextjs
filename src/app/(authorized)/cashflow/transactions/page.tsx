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
  
  // Handle categoryId instead of category name
  let initialCategory: string | undefined;
  let initialCategoryId: string | undefined;
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
  
  const initialMonth = resolvedSearchParams.month ? Number.parseInt(resolvedSearchParams.month as string, 10) : undefined;
  const initialYear = resolvedSearchParams.year ? Number.parseInt(resolvedSearchParams.year as string, 10) : undefined;
  const viewMode = resolvedSearchParams.view as string | undefined;

  return (
    <TransactionsClient
      bankAccounts={bankAccounts}
      initialCategory={initialCategory}
      initialCategoryId={initialCategoryId}
      initialMonth={initialMonth}
      initialYear={initialYear}
      viewMode={viewMode}
    />
  );
}
