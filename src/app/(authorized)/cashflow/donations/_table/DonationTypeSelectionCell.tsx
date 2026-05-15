import { AppSelect as Select } from '@/components/ui/AppSelect';
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
    <Select<OptionType>
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
      compact
      styles={{
        menuPortal: (provided) =>
          ({
            ...provided,
            zIndex: 9999,
          }) as typeof provided,
      }}
    />
  );
}
