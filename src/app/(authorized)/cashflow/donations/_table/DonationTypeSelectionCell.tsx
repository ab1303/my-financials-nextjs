import Select from 'react-select';

import { getCompactSelectStyles } from '@/lib/select-styles';
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
        ...getCompactSelectStyles<OptionType>(),
        menuPortal: (provided) =>
          ({
            ...provided,
            zIndex: 9999,
          }) as typeof provided,
      }}
    />
  );
}
