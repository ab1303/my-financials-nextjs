import CalendarClientWrapper from './CalendarClientWrapper';
import { Suspense } from 'react';
import type { FormInput } from './_schema';
import {
  createCalendarYearHandler,
  getCalendarYearsHandler,
  updateCalendarYearHandler,
  deleteCalendarYearHandler,
} from '@/server/controllers/calendar-year.controller';
import { revalidatePath } from 'next/cache';

export default async function CalendarYearPage() {
  async function upsertCalendarYear(formData: FormInput) {
    'use server';

    const { id, display, calendarType, fromDate, toDate } = formData;

    try {
      let result;
      if (id) {
        // Update existing calendar year
        result = await updateCalendarYearHandler(
          id,
          display,
          fromDate.getFullYear(),
          fromDate.getMonth() + 1,
          toDate.getFullYear(),
          toDate.getMonth() + 1,
          calendarType,
        );
      } else {
        // Create new calendar year
        result = await createCalendarYearHandler(
          display,
          fromDate.getFullYear(),
          fromDate.getMonth() + 1,
          toDate.getFullYear(),
          toDate.getMonth() + 1,
          calendarType,
        );
      }

      // Check if the operation was successful
      if (
        'calendarId' in result &&
        result.calendarId &&
        result.calendarId !== ''
      ) {
        // Revalidate calendar settings page
        revalidatePath('/settings/calendar');
        // Revalidate Bank Assets page to refresh calendar year dropdown
        revalidatePath('/cashflow/bank');
        return { success: true };
      } else {
        // Handle error case - result has error properties
        const errorMessage =
          'error' in result && typeof result.error === 'string'
            ? result.error
            : 'Failed to save calendar year';

        return {
          success: false,
          error: errorMessage,
          isReferentialIntegrityError:
            'isReferentialIntegrityError' in result &&
            typeof result.isReferentialIntegrityError === 'boolean'
              ? result.isReferentialIntegrityError
              : undefined,
        };
      }
    } catch (error) {
      return { success: false, error: 'Failed to save calendar year' };
    }
  }

  async function deleteCalendarYear(id: string) {
    'use server';

    try {
      const result = await deleteCalendarYearHandler(id);
      if (result.success) {
        // Revalidate calendar settings page
        revalidatePath('/settings/calendar');
        // Revalidate Bank Assets page to refresh calendar year dropdown
        revalidatePath('/cashflow/bank');
        return { success: true };
      } else {
        const errorMessage =
          'error' in result && typeof result.error === 'string'
            ? result.error
            : 'Failed to delete calendar year';

        return {
          success: false,
          error: errorMessage,
          isReferentialIntegrityError:
            'isReferentialIntegrityError' in result &&
            typeof result.isReferentialIntegrityError === 'boolean'
              ? result.isReferentialIntegrityError
              : undefined,
        };
      }
    } catch (error) {
      return { success: false, error: 'Failed to delete calendar year' };
    }
  }

  const calendarYearsData = await getCalendarYearsHandler();

  return (
    <main className='container mx-auto px-4 py-6 max-w-6xl'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold tracking-tight text-foreground'>
          Calendar Year(s)
        </h1>
        <p className='text-muted-foreground mt-1 text-sm'>
          Manage fiscal and zakat calendar years for reporting
        </p>
      </div>
      <div className='rounded-xl border border-border bg-card shadow p-6'>
        <Suspense fallback={<p className='font-medium'>Loading...</p>}>
          <CalendarClientWrapper
            tableData={calendarYearsData}
            upsertCalendarYear={upsertCalendarYear}
            deleteCalendarYear={deleteCalendarYear}
          />
        </Suspense>
      </div>
    </main>
  );
}
