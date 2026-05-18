import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { listRules } from '@/server/services/transactions/transfer-rule.service';
import TransferRulesTable from '@/app/(authorized)/settings/transfer-rules/_components/TransferRulesTable';

export const metadata = { title: 'Transfer Rules — My Financials' };

export default async function AccountTransferRulesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');

  const rules = await listRules({ prisma, userId: session.user.id });

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Transfer Match Rules</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Automatically match transfer pairs during CSV import
        </p>
      </div>
      <TransferRulesTable initialRules={rules} />
    </main>
  );
}
