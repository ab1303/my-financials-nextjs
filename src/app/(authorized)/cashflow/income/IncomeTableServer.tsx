import { incomeEntriesHandler } from '@/server/controllers/income.controller';
import { IncomeEntryStateProvider } from './StateProvider';
import IncomeTableClient from './IncomeTableClient';
import { auth } from '@/server/auth';

import type { IncomeEntryType } from './_types';
import { addRow, deleteRow, editRow } from './actions';

export type IncomeTableServerProps = {
  calendarYearId: string;
};

export default async function IncomeTableServer({
  calendarYearId,
}: IncomeTableServerProps) {
  try {
    // Get user session for user-specific data
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('User session not found');
    }

    const incomeEntries = await incomeEntriesHandler(
      calendarYearId,
      session.user.id,
    );

    const data =
      incomeEntries?.map<IncomeEntryType>((entry) => ({
        id: entry.id,
        amount: entry.amount,
        source: entry.source,
        dateEarned: entry.dateEarned,
        incomeId: entry.incomeId,
      })) || [];

    return (
      <IncomeEntryStateProvider data={data}>
        <IncomeTableClient
          addRow={addRow}
          editRow={editRow}
          deleteRow={deleteRow}
          calendarYearId={calendarYearId}
        />
      </IncomeEntryStateProvider>
    );
  } catch (error) {
    console.error('Error loading Income table data:', error);
    return (
      <div className='p-4 bg-red-50 border border-red-200 rounded-md'>
        <p className='text-red-800 font-medium'>
          Failed to load Income entries table
        </p>
        <p className='text-red-600 text-sm mt-1'>
          {error instanceof Error
            ? error.message
            : 'An unexpected error occurred'}
        </p>
        <p className='text-gray-600 text-xs mt-2'>
          Please refresh the page or contact support if the problem persists.
        </p>
      </div>
    );
  }
}
