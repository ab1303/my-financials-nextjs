'use client';

import { useState } from 'react';
import IncomeSources from './IncomeSources';
import ExpenseCategories from './ExpenseCategories';
import { cn } from '@/lib/utils';

type Tab = 'income' | 'expense';

export default function CategoriesClient() {
  const [tab, setTab] = useState<Tab>('income');

  return (
    <div>
      <div className='mb-6 flex gap-1 border-b border-border dark:border-border'>
        <button
          type='button'
          onClick={() => setTab('income')}
          className={cn(
            'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
            tab === 'income'
              ? 'border-primary text-primary dark:border-primary dark:text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground',
          )}
        >
          Income Sources
        </button>
        <button
          type='button'
          onClick={() => setTab('expense')}
          className={cn(
            'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
            tab === 'expense'
              ? 'border-primary text-primary dark:border-primary dark:text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground',
          )}
        >
          Expense Categories
        </button>
      </div>

      {tab === 'income' ? <IncomeSources /> : <ExpenseCategories />}
    </div>
  );
}
