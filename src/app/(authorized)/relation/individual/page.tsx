import IndividualForm from './form';

export default function IndividualPage() {
  return (
    <main className='container mx-auto px-4 py-6 max-w-4xl'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold tracking-tight text-foreground'>
          Individual Relations
        </h1>
        <p className='text-muted-foreground mt-1 text-sm'>
          Manage individual contacts and personal relationships
        </p>
      </div>
      <IndividualForm />
    </main>
  );
}
