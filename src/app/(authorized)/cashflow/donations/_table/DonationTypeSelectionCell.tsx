import Select from 'react-select';

import type { OptionType } from '@/types';

type DonationTypeSelectionCellProps = {
  donationType: string;
  onSelectionChange: (donationType?: string) => void;
  donationTypeOptions: Array<OptionType>;
};

export default function DonationTypeSelectionCell({
  donationType,
  onSelectionChange,
  donationTypeOptions,
}: DonationTypeSelectionCellProps) {
  const selectedOptionValue = donationTypeOptions.find(
    (o) => o.id === donationType,
  );

  return (
    <Select
      isClearable
      onChange={(newValue) => onSelectionChange(newValue?.id)}
      options={donationTypeOptions}
      value={selectedOptionValue}
      placeholder='Select donation type...'
      noOptionsMessage={() => 'No donation types available'}
      getOptionValue={(option) => option.id}
      getOptionLabel={(option) => option.label}
      menuPortalTarget={document.body}
      menuPosition='fixed'
      styles={{
        control: (provided) => ({
          ...provided,
          minHeight: 'auto',
          fontSize: '0.875rem',
          borderColor: '#d1d5db',
          '&:hover': {
            borderColor: '#d1d5db',
          },
        }),
        valueContainer: (provided) => ({
          ...provided,
          padding: '0.25rem 0.5rem',
        }),
        input: (provided) => ({
          ...provided,
          margin: 0,
          padding: 0,
        }),
        indicatorSeparator: () => ({ display: 'none' }),
        indicatorsContainer: (provided) => ({
          ...provided,
          height: 'auto',
        }),
        menu: (provided) => ({
          ...provided,
          zIndex: 9999,
        }),
        menuPortal: (provided) => ({
          ...provided,
          zIndex: 9999,
        }),
      }}
    />
  );
}
