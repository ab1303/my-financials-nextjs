import BrokeragesForm from './form';

export default function BrokeragesPage() {
  return (
    <main className='px-4 sm:px-6 lg:px-8 py-6'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold tracking-tight text-foreground'>
          Brokerage Institutions
        </h1>
        <p className='text-muted-foreground mt-1 text-sm'>
          Manage global brokerage institutions shared across all users
        </p>
      </div>
      <BrokeragesForm />
    </main>
  );
}
