'use client';
import { Button } from '@/components';
import DatePickerDialog from '@/components/DatePickerDialog';
import { Label, Radio } from 'flowbite-react';
import type { SubmitHandler } from 'react-hook-form';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import type { ServerActionType } from './_types';
import { CALENDAR_KEYS, CALENDAR_MAP } from './_types';
import { FormDataSchema } from './_schema';
import type { FormInput } from './_schema';
import clsx from 'clsx';

type CalendarFormProps = {
  initialData: unknown;
  children?: React.ReactNode;
  addCalendarYear: (formData: FormInput) => Promise<ServerActionType>;
};

const currentDate = new Date(),
  y = currentDate.getFullYear();

export default function CalendarForm({ addCalendarYear }: CalendarFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormInput>({
    resolver: zodResolver(FormDataSchema),
    defaultValues: {
      fromDate: new Date(y, 0, 1),
      toDate: new Date(y, 12, 0),
    },
  });

  const processForm: SubmitHandler<FormInput> = async (data) => {
    console.log('Submit click', data);
    const result = await addCalendarYear(data);

    if (!result) {
      console.log('Something went wrong');
      return;
    }

    if (result.error) {
      console.log(result.error);
      return;
    }

    reset();
  };

  return (
    <form className='mb-0 space-y-6' onSubmit={handleSubmit(processForm)}>
      <div className='w-1/2 mx-10'>
        <label htmlFor='display'>Display</label>
        <div className='mt-1'>
          <input
            id='display'
            type='text'
            className={clsx(
              errors.display && 'text-orange-700 border-orange-700'
            )}
            {...register('display', { required: true })}
          />
        </div>
      </div>
      <div className='flex'>
        <div className='w-1/3'>
          <div className='mx-10'>
            <Label>From Date:</Label>
            <div className='mt-3'>
              <Controller
                name='fromDate'
                control={control}
                render={({ field: { onChange, value } }) => (
                  <DatePickerDialog
                    selectedDate={value}
                    onDateChange={(changedDate) => {
                      onChange(changedDate);
                      return;
                    }}
                  />
                )}
              />
            </div>
          </div>
        </div>
        <div className='w-1/3 ml-3'>
          <div className='mx-10'>
            <Label>To Date:</Label>
            <div className='mt-3'>
              <Controller
                name='toDate'
                control={control}
                render={({ field: { onChange, value } }) => (
                  <DatePickerDialog
                    selectedDate={value}
                    onDateChange={(changedDate) => {
                      onChange(changedDate);
                      return;
                    }}
                  />
                )}
              />
            </div>
          </div>
        </div>
        <div className='w-1/3 ml-3'>
          <fieldset className='flex max-w-md flex-col gap-4' id='radio'>
            <div
              className={clsx(
                'flex gap-2',
                errors.calendarType &&
                  'border rounded-xl p-2  text-orange-700 border-orange-700'
              )}
            >
              {CALENDAR_KEYS.map((k) => {
                const calendarKey = k;
                return (
                  <div key={k} className='flex items-center gap-2'>
                    <Radio
                      id={k}
                      value={CALENDAR_MAP[calendarKey]}
                      {...register('calendarType', { required: true })}
                    />
                    <Label htmlFor={k}>{CALENDAR_MAP[calendarKey]}</Label>
                  </div>
                );
              })}
            </div>
          </fieldset>
        </div>
      </div>
      <div className='mx-10'>
        <Button
          // isLoading={saveBankDetailsMutation.isLoading}
          variant='primary'
          type='submit'
        >
          Create
        </Button>
      </div>
    </form>
  );
}
