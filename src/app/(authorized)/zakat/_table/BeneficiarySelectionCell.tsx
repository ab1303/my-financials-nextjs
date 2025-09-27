import { useState } from 'react';
import Select from 'react-select';
import { toast } from 'react-toastify';

import { trpc } from '@/server/trpc/client';

import type { OptionType } from '@/types';
import type { BeneficiaryEnumType } from '@prisma/client';

type BeneficiarySelectionCellProps = {
  defaultIndividualOptions: Array<OptionType>;
  beneficiaryType: BeneficiaryEnumType;
  beneficiaryId: string;
  onSelectionChange: (beneficiaryId?: string) => void;
};

export default function BeneficiarySelectionCell({
  defaultIndividualOptions,
  beneficiaryType,
  beneficiaryId,
  onSelectionChange,
}: BeneficiarySelectionCellProps) {
  // Fetch business options when beneficiary type is BUSINESS
  const getBusinessesQuery = trpc.business.getAllBusinesses.useQuery(
    undefined,
    {
      enabled: beneficiaryType === 'BUSINESS',
    },
  );

  const businessOptions: OptionType[] =
    getBusinessesQuery.data?.map((business) => ({
      id: business.id,
      label: business.name,
    })) || [];

  // Get the current options based on beneficiary type
  const currentOptions =
    beneficiaryType === 'BUSINESS' ? businessOptions : defaultIndividualOptions;
  const selectedOptionValue = currentOptions.find(
    (o) => o.id === beneficiaryId,
  );

  if (getBusinessesQuery.error) {
    toast.error('Failed to load business options');
  }

  return (
    <Select
      isClearable
      isDisabled={
        beneficiaryType === 'BUSINESS' && getBusinessesQuery.isLoading
      }
      isLoading={beneficiaryType === 'BUSINESS' && getBusinessesQuery.isLoading}
      onChange={(newValue) => onSelectionChange(newValue?.id)}
      options={currentOptions}
      value={selectedOptionValue}
      placeholder={
        beneficiaryType === 'BUSINESS'
          ? 'Select a business...'
          : 'Select an individual...'
      }
      getOptionValue={(option) => option.id}
      getOptionLabel={(option) => option.label}
    />
  );
}
