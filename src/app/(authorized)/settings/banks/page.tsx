import BanksForm from './form';

export default function BanksPage() {
  return (
    <main className='px-4 sm:px-6 lg:px-8 py-6'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold tracking-tight text-foreground'>
          Bank Accounts
        </h1>
        <p className='text-muted-foreground mt-1 text-sm'>
          Manage your bank accounts and financial institution details
        </p>
      </div>
      <BanksForm />
    </main>
  );
}
