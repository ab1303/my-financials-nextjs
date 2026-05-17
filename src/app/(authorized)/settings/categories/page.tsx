import CategoriesClient from './_components/CategoriesClient';

export default function CategoriesPage() {
  return (
    <main className='px-4 py-6 sm:px-6 lg:px-8'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold tracking-tight text-foreground dark:text-foreground'>
          Categories
        </h1>
        <p className='mt-1 text-sm text-muted-foreground dark:text-muted-foreground'>
          Manage income sources and expense categories
        </p>
      </div>
      <CategoriesClient />
    </main>
  );
}
