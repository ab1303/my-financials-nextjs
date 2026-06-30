import 'react-phone-input-2/lib/style.css';

import type { ChangeEvent } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import PhoneInput from 'react-phone-input-2';

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
          isValid={(inputNumber, country, countries) => {
            if (!fieldState.isDirty) return true;
            if (!country) return false;

            type Country = { dialCode: string };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const typedCountry = country as any as Country;
            const selectedCountry = (countries as Country[]).find(
              (c) => c.dialCode === typedCountry.dialCode,
            );

            if (!selectedCountry) {
              return false;
            }

            const numberExDialCode = inputNumber.split(
              selectedCountry.dialCode,
            )[1];

            const phoneLength = numberExDialCode?.length;

            return !!phoneLength && phoneLength > 7 && phoneLength < 10
              ? true
              : false;
          }}
          onChange={(_, __, event) =>
            onChange(
              (event as ChangeEvent<HTMLInputElement> | undefined)?.target
                .value ?? '',
            )
          }
        />
      )}
    />
  );
}
