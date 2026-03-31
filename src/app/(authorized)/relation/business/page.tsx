import BusinessForm from './form';

export default function BusinessPage() {
  return (
    <main className='container mx-auto px-4 py-6 max-w-4xl'>
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
