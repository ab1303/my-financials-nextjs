import Card from '@/components/card';
import CalendarForm from './form';
import { Suspense } from 'react';
import type { FormInput } from './_schema';
import {
  createCalendarYearHandler,
  getCalendarYearsHandler,
} from '@/server/controllers/calendar-year.controller';
import CalendarTableClient from './CalendarTableClient';
import { revalidatePath } from 'next/cache';

export default async function CalendarYearPage() {
  async function addCalendarYear(formData: FormInput) {
    'use server';

    const { display, calendarType, fromDate, toDate } = formData;
    await createCalendarYearHandler(
      display,
      fromDate.getFullYear(),
      fromDate.getMonth() + 1,
      toDate.getFullYear(),
      toDate.getMonth() + 1,
      calendarType
    );
    // mutate data
    revalidatePath('/settings/calendar');

    return { success: true, error: null };
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
        <CalendarForm
          addCalendarYear={addCalendarYear}
          initialData={{ a: 1 }}
        ></CalendarForm>
        <Suspense fallback={<p className='font-medium'>Loading table...</p>}>
          <div className='font-mono text-gray-500 mt-12 mb-4'>
            Calendar year(s)
          </div>
          <CalendarTableClient tableData={calendarYearsData} />
        </Suspense>
      </div>
    </>
  );
}
