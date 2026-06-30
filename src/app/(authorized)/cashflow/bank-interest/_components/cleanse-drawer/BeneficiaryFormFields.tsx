'use client';

import { BeneficiaryEnumType } from '@prisma/client';
import { Controller } from 'react-hook-form';
import type { CSSObjectWithLabel } from 'react-select';
import CreatableSelect from 'react-select/creatable';

import { SelectWrapper as Select } from '@/components/ui/Select';
import { getSelectStyles } from '@/lib/select-styles';

import { useCleanseDonation } from './CleanseDonationContext';
import { type BeneficiaryOption } from './types';

type BeneficiaryFormFieldsProps = {
  disabled: boolean;
};

export function BeneficiaryFormFields({
  disabled,
}: BeneficiaryFormFieldsProps) {
  const {
    linkedForm,
    manualForm,
    mode,
    linkedBeneficiaryType,
    manualBeneficiaryType,
    getBeneficiaryOptions,
    setCreateModalOpen,
    setPendingBeneficiaryName,
  } = useCleanseDonation();

  const isLinked = mode === 'linked';
  const form = isLinked ? linkedForm : manualForm;
  const beneficiaryType = isLinked
    ? linkedBeneficiaryType
    : manualBeneficiaryType;
  const beneficiaryOptions = getBeneficiaryOptions(beneficiaryType);

  return (
    <div className='grid gap-4'>
      <div>
        <label className='mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200'>
          Beneficiary type
        </label>
        <Controller
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          control={form.control as any}
          name='beneficiaryType'
          render={({ field }) => {
            const options = [
              { value: BeneficiaryEnumType.INDIVIDUAL, label: 'Individual' },
              { value: BeneficiaryEnumType.BUSINESS, label: 'Business' },
            ];
            const selected =
              options.find((o) => o.value === field.value) ||
              options.find((o) => o.value === BeneficiaryEnumType.BUSINESS);
            return (
              <Select
                instanceId='beneficiary-type-select'
                inputId='beneficiaryType'
                isDisabled={disabled}
                options={options}
                value={selected}
                onChange={(option) => field.onChange(option?.value)}
                styles={
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  {
                    ...getSelectStyles(),
                    menuPortal: (base: CSSObjectWithLabel) => ({
                      ...base,
                      zIndex: 9999,
                    }),
                  } as any
                }
                usePortal
              />
            );
          }}
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          control={form.control as any}
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
                  menuPortal: (base: CSSObjectWithLabel) => ({
                    ...base,
                    zIndex: 9999,
                  }),
                }}
                menuPortalTarget={
                  typeof document !== 'undefined' ? document.body : null
                }
                menuPosition='fixed'
              />
            );
          }}
        />
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {(form.formState.errors as any).beneficiaryId && (
          <p className='mt-1 text-xs text-red-600 dark:text-red-400'>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {String((form.formState.errors as any).beneficiaryId.message)}
          </p>
        )}
      </div>
    </div>
  );
}
