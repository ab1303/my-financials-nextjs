import Card from '@/components/card';
import CalendarForm from './form';
import { Suspense } from 'react';
import type { FormInput } from './_schema';
import { createCalendarYearHandler } from '@/server/controllers/calendar-year.controller';

export default function CalendarYearPage() {
  async function addCalendarYear(formData: FormInput) {
    'use server';

    const { display, calendarType, fromDate, toDate } = formData;
    await createCalendarYearHandler(
      display,
      fromDate.getFullYear(),
      fromDate.getMonth(),
      toDate.getFullYear(),
      toDate.getMonth(),
      calendarType
    );
    // mutate data
    // revalidate cache
    return { success: true, error: null };
  }
  return (
    <>
      <Card.Header>
        <div className='flex justify-between mt-4 text-left'>
          <Card.Header.Title>Calendar Year(s)</Card.Header.Title>
        </div>
      </Card.Header>
      <div className='bg-white shadow mt-4 py-8 px-6 sm:px-10 rounded-lg'>
        <CalendarForm addCalendarYear={addCalendarYear} initialData={{ a: 1 }}>
          <Suspense fallback={<p className='font-medium'>Loading table...</p>}>
            <div className='font-mono text-gray-500 mb-3'>
              New Calendar year
            </div>
          </Suspense>
        </CalendarForm>
      </div>
    </>
  );
}
