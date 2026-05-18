import BankAccountsSection from '@/app/(authorized)/settings/banks/_components/BankAccountsSection';

export const metadata = { title: 'Bank Accounts — My Financials' };

export default function AccountBankAccountsPage() {
  return (
    <main className='px-4 py-6 sm:px-6 lg:px-8'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold tracking-tight text-foreground'>
          Bank Accounts
        </h1>
        <p className='mt-1 text-sm text-muted-foreground'>
          Manage your personal bank accounts used for CSV imports
        </p>
      </div>
      <BankAccountsSection />
    </main>
  );
}
