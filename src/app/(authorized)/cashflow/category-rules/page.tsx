import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { listRules } from '@/server/services/transactions/category-rule.service';
import CategoryRulesTable from './_components/CategoryRulesTable';

export const metadata = {
  title: 'Category Rules',
};

export default async function CategoryRulesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');

  const rules = await listRules({ prisma, userId: session.user.id });

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Category Rules
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Automatically assign categories to transactions matching a pattern. Rules are created when you re-categorize a transaction and save the pattern.
        </p>
      </div>
      <CategoryRulesTable initialRules={rules} />
    </main>
  );
}
