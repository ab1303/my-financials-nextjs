import { redirect } from 'next/navigation';

import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { listCategoryGroups } from '@/server/services/category-groups/category-groups.service';

import CategoryGroupsDashboard from './_components/CategoryGroupsDashboard';

export const metadata = {
  title: 'Category Groups',
};

export default async function CategoryGroupsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');

  const groups = await listCategoryGroups({ prisma, userId: session.user.id });

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Category Groups
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define reusable category groups to organize your income sources and
            expense categories. Use these groups for filtering and analysis across
            the app.
          </p>
        </div>
      </div>
      <CategoryGroupsDashboard initialGroups={groups} />
    </main>
  );
}
