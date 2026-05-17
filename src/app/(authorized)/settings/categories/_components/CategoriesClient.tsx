'use client';

import IncomeSources from './IncomeSources';
import ExpenseCategories from './ExpenseCategories';

export default function CategoriesClient() {
  return (
    <div className='grid grid-cols-1 gap-8 lg:grid-cols-2'>
      <section aria-labelledby='income-sources-heading'>
        <div className='mb-4'>
          <h2
            id='income-sources-heading'
            className='text-base font-semibold text-foreground'
          >
            Income Sources
          </h2>
          <p className='mt-0.5 text-xs text-muted-foreground'>
            Sources used when recording income entries
          </p>
        </div>
        <IncomeSources />
      </section>

      <section aria-labelledby='expense-categories-heading'>
        <div className='mb-4'>
          <h2
            id='expense-categories-heading'
            className='text-base font-semibold text-foreground'
          >
            Expense Categories
          </h2>
          <p className='mt-0.5 text-xs text-muted-foreground'>
            Categories used when classifying expense transactions
          </p>
        </div>
        <ExpenseCategories />
      </section>
    </div>
  );
}
