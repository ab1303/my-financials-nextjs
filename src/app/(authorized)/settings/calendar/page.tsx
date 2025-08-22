import Card from '@/components/card';
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
      if (id) {
        // Update existing calendar year
        await updateCalendarYearHandler(
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
        await createCalendarYearHandler(
          display,
          fromDate.getFullYear(),
          fromDate.getMonth() + 1,
          toDate.getFullYear(),
          toDate.getMonth() + 1,
          calendarType,
        );
      }

      // mutate data
      revalidatePath('/settings/calendar');
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: 'Failed to save calendar year' };
    }
  }

  async function deleteCalendarYear(id: string) {
    'use server';

    try {
      await deleteCalendarYearHandler(id);
      revalidatePath('/settings/calendar');
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: 'Failed to delete calendar year' };
    }
  }

  const calendarYearsData = await getCalendarYearsHandler();

  return (
    <>
      <Card.Header>
        <div className='flex justify-between mt-4 text-left'>
          <Card.Header.Title>Calendar Year(s)</Card.Header.Title>
        </div>
      </Card.Header>
      <div className='bg-white shadow mt-4 py-8 px-6 sm:px-10 rounded-lg'>
        <Suspense fallback={<p className='font-medium'>Loading...</p>}>
          <CalendarClientWrapper
            tableData={calendarYearsData}
            upsertCalendarYear={upsertCalendarYear}
            deleteCalendarYear={deleteCalendarYear}
          />
        </Suspense>
      </div>
    </>
  );
}
