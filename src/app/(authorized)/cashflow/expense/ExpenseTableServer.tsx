import { getExpenseDataHandler } from '@/server/controllers/expense.controller';
import ExpenseTableClient from './ExpenseTableClient';

export type ExpenseTableServerProps = {
  calendarYearId: string;
  userId: string;
  dateFrom: Date;
  dateTo: Date;
  calendarLabel: string;
  fromMonth: number;
  fromYear: number;
};

export default async function ExpenseTableServer({
  calendarYearId,
  userId,
  dateFrom,
  dateTo,
  calendarLabel,
  fromMonth,
  fromYear,
}: ExpenseTableServerProps) {
  const expenseData = await getExpenseDataHandler(calendarYearId, userId);

  if (!expenseData) {
    return (
      <div className='p-4 bg-yellow-50 border border-yellow-200 rounded-md'>
        <p className='text-yellow-800 font-medium'>
          Unable to load expense data
        </p>
        <p className='text-yellow-600 text-sm mt-1'>
          Please try refreshing the page or contact support if the issue
          persists.
        </p>
      </div>
    );
  }

  return (
    <ExpenseTableClient
      calendarYearId={calendarYearId}
      monthlySummaries={expenseData.monthlySummaries}
      dateFrom={dateFrom}
      dateTo={dateTo}
      calendarLabel={calendarLabel}
      fromMonth={fromMonth}
      fromYear={fromYear}
    />
  );
}
