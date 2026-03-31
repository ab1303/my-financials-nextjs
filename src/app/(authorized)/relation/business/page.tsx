import BusinessForm from './form';

export default function BusinessPage() {
  return (
    <main className='px-4 sm:px-6 lg:px-8 py-6'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold tracking-tight text-foreground'>
          Business Relations
        </h1>
        <p className='text-muted-foreground mt-1 text-sm'>
          Manage your business contacts and relationships
        </p>
      </div>
      <BusinessForm />
    </main>
  );
}
