import Select from 'react-select';
import { getSelectStyles } from '@/lib/select-styles';
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
        ...getSelectStyles<OptionType>(),
        menuPortal: (base) => ({ ...base, zIndex: 9999 }) as typeof base,
      }}
    />
  );
}
