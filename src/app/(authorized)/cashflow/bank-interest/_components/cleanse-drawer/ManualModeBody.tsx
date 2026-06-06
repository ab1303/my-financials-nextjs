'use client';

import { Info } from 'lucide-react';
import { Controller } from 'react-hook-form';
import { BeneficiaryFormFields } from './BeneficiaryFormFields';
import { useCleanseDonation } from './CleanseDonationContext';

export function ManualModeBody() {
  const {
    manualForm,
    isSaving,
    handleManualSave,
    handleClose,
  } = useCleanseDonation();

  const {
    control,
    register,
    formState: { errors, isValid },
  } = manualForm;

  return (
    <div className='flex flex-1 flex-col overflow-y-auto h-full'>
      <div className='flex-1 p-6'>
        <div className='mx-auto w-full max-w-lg space-y-6'>
          <div className='rounded-md border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/30'>
            <div className='flex gap-3'>
              <Info className='h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0' />
              <div>
                <p className='text-sm font-medium text-blue-900 dark:text-blue-100'>
                  Manual Record
                </p>
                <p className='text-xs text-blue-700 dark:text-blue-300 mt-1'>
                  Use this mode to record a cleansing donation that was made
                  with cash or from an untracked bank account.
                </p>
              </div>
            </div>
          </div>

          <div className='grid gap-4'>
            <div>
              <label
                htmlFor='manual-datePaid'
                className='mb-1 block cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-200'
              >
                Date paid
              </label>
              <input
                id='manual-datePaid'
                type='date'
                {...register('datePaid')}
                className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100'
              />
              {errors.datePaid && (
                <p className='mt-1 text-xs text-red-600 dark:text-red-400'>
                  {errors.datePaid.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor='manual-amount'
                className='mb-1 block cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-200'
              >
                Donation amount (AUD)
              </label>
              <Controller
                control={control}
                name='amount'
                render={({ field }) => (
                  <input
                    id='manual-amount'
                    type='number'
                    step='0.01'
                    min='0.01'
                    value={field.value || ''}
                    onChange={(event) =>
                      field.onChange(parseFloat(event.target.value) || 0)
                    }
                    className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100'
                    placeholder='0.00'
                  />
                )}
              />
              {errors.amount && (
                <p className='mt-1 text-xs text-red-600 dark:text-red-400'>
                  {errors.amount.message}
                </p>
              )}
            </div>

            <BeneficiaryFormFields disabled={false} />
          </div>
        </div>
      </div>

      <div className='flex items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-800 dark:bg-gray-950'>
        <button
          type='button'
          onClick={handleClose}
          className='rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'
        >
          Cancel
        </button>
        <button
          type='button'
          onClick={handleManualSave}
          disabled={!isValid || isSaving}
          className='rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600'
        >
          {isSaving ? 'Saving...' : 'Save Manual Record'}
        </button>
      </div>
    </div>
  );
}
