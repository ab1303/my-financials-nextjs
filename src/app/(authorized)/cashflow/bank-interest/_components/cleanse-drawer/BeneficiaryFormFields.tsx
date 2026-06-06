'use client';

import { BeneficiaryEnumType } from '@prisma/client';
import { Control, Controller, FieldErrors } from 'react-hook-form';
import CreatableSelect from 'react-select/creatable';
import { AppSelect as Select } from '@/components/ui/AppSelect';
import { getSelectStyles } from '@/lib/select-styles';
import { BeneficiaryOption } from './types';

type BeneficiaryFormFieldsProps = {
  control: Control<any>;
  errors: FieldErrors<any>;
  beneficiaryType: BeneficiaryEnumType;
  beneficiaryOptions: BeneficiaryOption[];
  disabled: boolean;
  setCreateModalOpen: (value: boolean) => void;
  setPendingBeneficiaryName: (value: string) => void;
};

export function BeneficiaryFormFields({
  control,
  errors,
  beneficiaryType,
  beneficiaryOptions,
  disabled,
  setCreateModalOpen,
  setPendingBeneficiaryName,
}: BeneficiaryFormFieldsProps) {
  return (
    <div className='grid gap-4'>
      <div>
        <label className='mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200'>
          Beneficiary type
        </label>
        <Controller
          control={control}
          name='beneficiaryType'
          render={({ field }) => (
            <Select
              instanceId='beneficiary-type-select'
              inputId='beneficiaryType'
              isDisabled={disabled}
              options={[
                { value: BeneficiaryEnumType.INDIVIDUAL, label: 'Individual' },
                { value: BeneficiaryEnumType.BUSINESS, label: 'Business' },
              ]}
              value={{
                value: field.value,
                label:
                  field.value === BeneficiaryEnumType.BUSINESS
                    ? 'Business'
                    : 'Individual',
              }}
              onChange={(option) => field.onChange(option?.value)}
            />
          )}
        />
      </div>

      <div>
        <label
          htmlFor='beneficiaryId'
          className='mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200'
        >
          Beneficiary
        </label>
        <Controller
          control={control}
          name='beneficiaryId'
          render={({ field }) => {
            const selected =
              beneficiaryOptions.find((item) => item.value === field.value) ??
              null;
            return (
              <CreatableSelect
                instanceId='beneficiary-id-select'
                inputId='beneficiaryId'
                isDisabled={disabled}
                options={beneficiaryOptions}
                value={selected}
                onChange={(option) => field.onChange(option?.value ?? '')}
                onCreateOption={(inputValue) => {
                  setPendingBeneficiaryName(inputValue);
                  setCreateModalOpen(true);
                }}
                placeholder='Select or create a beneficiary…'
                formatCreateLabel={(value) => `+ Create "${value}"`}
                styles={{
                  ...getSelectStyles<BeneficiaryOption>(),
                  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                }}
                menuPortalTarget={
                  typeof document !== 'undefined' ? document.body : null
                }
                menuPosition='fixed'
              />
            );
          }}
        />
        {errors.beneficiaryId && (
          <p className='mt-1 text-xs text-red-600 dark:text-red-400'>
            {String(errors.beneficiaryId.message)}
          </p>
        )}
      </div>
    </div>
  );
}
