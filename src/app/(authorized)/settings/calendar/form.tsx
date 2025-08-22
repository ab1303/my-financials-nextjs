'use client';
import { Button } from '@/components';
import DatePickerDialog from '@/components/DatePickerDialog';
import { Label } from '@/components/ui/Label';
import { Radio } from '@/components/ui/Radio';
import { TextInput } from '@/components/ui/TextInput';
import { HiOutlineInformationCircle } from 'react-icons/hi';
import type { SubmitHandler } from 'react-hook-form';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import type { ServerActionType } from './_types';
import { CALENDAR_KEYS } from './_types';
import { FormDataSchema } from './_schema';
import type { FormInput } from './_schema';
import clsx from 'clsx';
import { CalendarEnumType } from '@prisma/client';

type CalendarFormProps = {
  initialData: unknown;
  children?: React.ReactNode;
  addCalendarYear: (formData: FormInput) => Promise<ServerActionType>;
};

const currentDate = new Date(),
  y = currentDate.getFullYear();

export default function CalendarForm({ addCalendarYear }: CalendarFormProps) {
  // Descriptions for each calendar type
  const descriptions: Record<string, string> = {
    ZAKAT: 'Year used for Zakat calculation, based on Islamic lunar calendar.',
    ANNUAL: 'Standard calendar year (Jan-Dec) for regular reporting.',
    FISCAL: 'Fiscal year, used for business accounting and tax purposes.',
  };
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
        <Label htmlFor='display'>Display</Label>
        <div className='mt-1'>
          <TextInput
            id='display'
            type='text'
            error={!!errors.display}
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
                  'border rounded-xl p-2  text-orange-700 border-orange-700',
              )}
            >
              {CALENDAR_KEYS.map((calendarKey) => (
                <div key={calendarKey} className='flex items-center gap-2'>
                  <Radio
                    id={calendarKey}
                    value={CalendarEnumType[calendarKey]}
                    {...register('calendarType', { required: true })}
                  />
                  <Label htmlFor={calendarKey}>
                    {CalendarEnumType[calendarKey]}
                  </Label>
                  {/* Info icon with tooltip using Heroicons via React Icons */}
                  <span className='relative group'>
                    <HiOutlineInformationCircle
                      className='w-4 h-4 text-gray-400 cursor-pointer'
                      aria-label='Info'
                    />
                    <span className='absolute left-1/2 -translate-x-1/2 mt-2 z-10 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg'>
                      {descriptions[calendarKey]}
                    </span>
                  </span>
                </div>
              ))}
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
