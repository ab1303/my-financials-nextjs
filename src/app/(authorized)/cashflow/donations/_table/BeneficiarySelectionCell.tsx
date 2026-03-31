import Select from 'react-select';
import { toast } from 'sonner';

import { trpc } from '@/server/trpc/client';

import type { OptionType } from '@/types';
import type { BeneficiaryEnumType, Business } from '@prisma/client';

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
  // Fetch business options when beneficiary type is BUSINESS (only PHILANTHROPY type)
  const getBusinessesQuery = trpc.business.getBusinessesByType.useQuery(
    { type: 'PHILANTHROPY' },
    {
      enabled: beneficiaryType === 'BUSINESS',
    },
  );

  const businessOptions: OptionType[] =
    getBusinessesQuery.data?.map((business: Business) => ({
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
          ? businessOptions.length === 0 && !getBusinessesQuery.isLoading
            ? 'No philanthropy businesses found'
            : 'Select a business...'
          : 'Select an individual...'
      }
      noOptionsMessage={() =>
        beneficiaryType === 'BUSINESS'
          ? 'No philanthropy businesses available'
          : 'No individuals available'
      }
      getOptionValue={(option) => option.id}
      getOptionLabel={(option) => option.label}
      menuPortalTarget={document.body}
      menuPosition='fixed'
      styles={{
        control: (provided) =>
          ({
            ...provided,
            minHeight: 'auto',
            fontSize: '0.875rem',
            borderColor: '#d1d5db',
            '&:hover': {
              borderColor: '#d1d5db',
            },
          }) as typeof provided,
        valueContainer: (provided) =>
          ({
            ...provided,
            padding: '0.25rem 0.5rem',
          }) as typeof provided,
        input: (provided) =>
          ({
            ...provided,
            margin: 0,
            padding: 0,
          }) as typeof provided,
        indicatorSeparator: () => ({ display: 'none' }),
        indicatorsContainer: (provided) =>
          ({
            ...provided,
            height: 'auto',
          }) as typeof provided,
        menu: (provided) =>
          ({
            ...provided,
            zIndex: 9999,
          }) as typeof provided,
        menuPortal: (provided) =>
          ({
            ...provided,
            zIndex: 9999,
          }) as typeof provided,
      }}
    />
  );
}
