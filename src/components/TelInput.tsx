import { Controller, useFormContext } from 'react-hook-form';
import PhoneInput from 'react-phone-input-2';

import 'react-phone-input-2/lib/style.css';

type TelInputComponentProps = {
  propertyName: string;
};

export default function TelInput({ propertyName }: TelInputComponentProps) {
  const { control } = useFormContext();

  return (
    <Controller
      name={propertyName}
      control={control}
      rules={{
        required: true,
        validate: (inputNumber) => {
          const numberExCountryCode = inputNumber.split('61')[1];

          if (!numberExCountryCode) return false;

          const phoneLength = numberExCountryCode.length;
          return phoneLength > 8 && phoneLength < 12;
        },
      }}
      render={({ field: { onChange, value }, fieldState }) => (
        <PhoneInput
          enableAreaCodes
          enableAreaCodeStretch
          country={'au'}
          onlyCountries={['au']}
          value={value}
          isValid={(inputNumber, country: any, countries) => {
            if (!fieldState.isDirty) return true;

            const selectedCountry = countries.find(
              (c: any) => c.dialCode === country.dialCode
            ) as any;

            if (!selectedCountry) {
              return false;
            }

            const numberExDialCode = inputNumber.split(
              selectedCountry.dialCode
            )[1];

            const phoneLength = numberExDialCode?.length;

            return !!phoneLength && phoneLength > 7 && phoneLength < 10
              ? true
              : false;
          }}
          onChange={(_, __, event: React.ChangeEvent<HTMLInputElement>) =>
            onChange(event.target.value)
          }
        />
      )}
    />
  );
}
