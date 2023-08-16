import clsx from 'clsx';
import * as React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import AsyncSelect from 'react-select/async';
import { useDebouncedCallback } from 'use-debounce';
import usePlacesAutocomplete, { getGeocode } from 'use-places-autocomplete';

import type { Options, SingleValue } from 'react-select';
import type {
  FieldError,
  FieldValues,
} from 'react-hook-form';

import type { Address, FilteredKeys } from '@/types';
import { useId } from 'react';

const debounce = 300;
const minLengthAutocomplete = 3;
const selectProps = {
  isClearable: true,
};

type AddressPropertyNames<TAddressSuper> = FilteredKeys<TAddressSuper, Address>;

type AddressFields<T> = 
{[P in keyof Address as `${P}Name`]: `${string & AddressPropertyNames<T>}.${P}`} &
 {[P in keyof Address as `${P}Error`]: FieldError | undefined }
;

interface Props<T extends FieldValues> {
  basePropertyName: AddressPropertyNames<T>;
  addressFields: AddressFields<T>
}

export default function AddressComponent<T extends FieldValues>({
  basePropertyName,
  addressFields
}: Props<T>) {

  // https://github.com/JedWatson/react-select/issues/5459
  const uniqId = useId();
  const {
    ready,
    suggestions: { data },
    setValue: addressAutoCompleteSetValue,
  } = usePlacesAutocomplete({    
    callbackName: 'initialiseGoogleMap',
    requestOptions: {
      componentRestrictions: {
        country: 'AU',
      },
    },
  });


  const { register, control, setValue: formFieldSetValue } = useFormContext();

  const fetchSuggestions = useDebouncedCallback(
    React.useCallback(
      (
        value: string,
        cb: (options: Options<{ label: string }>) => void
      ): void => {
        if (value.length < minLengthAutocomplete) return cb([]);

        addressAutoCompleteSetValue(value);
        cb(
          (data || []).map((suggestion) => ({
            label: suggestion.description,
            value: suggestion,
          }))
        );
      },
      [data, addressAutoCompleteSetValue]
    ),
    debounce
  );

  const handleSelect = (selectedOption: SingleValue<{ label: string }>) => {
    // Loop like an Array
    if (!selectedOption) {
      formFieldSetValue(String(addressFields.addressLineName), '');
      formFieldSetValue(`${String(basePropertyName)}.street_address`, '');
      formFieldSetValue(`${String(basePropertyName)}.suburb`, '');
      formFieldSetValue(`${String(basePropertyName)}.postcode`, '');
      formFieldSetValue(`${String(basePropertyName)}.state`, '');
      return;
    }

    // Get latitude and longitude via utility functions
    getGeocode({ address: selectedOption?.label })
      .then((results) => {
        if (!results.length || !results[0]) return;

        const addressComponents = results[0].address_components;
        const streetAddressNumber = addressComponents.find((c) =>
          c.types.includes('street_number')
        )?.long_name;

        const streetAddress = addressComponents.find((c) =>
          c.types.includes('route')
        )?.long_name;

        const suburb = addressComponents.find((c) =>
          c.types.includes('locality')
        )?.long_name;

        const state = addressComponents.find((c) =>
          c.types.includes('administrative_area_level_1')
        )?.long_name;

        const postalcode = addressComponents.find((c) =>
          c.types.includes('postal_code')
        )?.long_name;

        formFieldSetValue(
          String(addressFields.street_addressName),
          `${streetAddressNumber || ''} ${streetAddress}`
        );
        formFieldSetValue(String(addressFields.suburbName), suburb || '');
        formFieldSetValue(`${String(basePropertyName)}.postcode`, postalcode || '');
        formFieldSetValue(`${String(basePropertyName)}.state`, state || '');
      })
      .catch(() => {
        // console.log('😱 Error: ', error);
      });
  };

  return (
    <>     
      <div>
        <label
          htmlFor='addressLine'
          className={clsx(
            'block text-sm font-medium ',
            addressFields.addressLineError ? 'text-orange-700' : 'text-gray-700'
          )}
        >
          Address
        </label>
        <div className='mt-1'>
          {ready && <Controller
            name={String(addressFields.addressLineName)}
            control={control}
            rules={{
              required: true,
            }}
            render={({ field: { onChange, value } }) => (
              <AsyncSelect
                instanceId={uniqId}
                {...selectProps}
                styles={{
                  control: (base) => ({
                    ...base,
                    borderColor: addressFields.addressLineError && 'rgba(194, 65, 12)',
                  }),
                }}
                value={{ label: String(value) }}
                loadOptions={fetchSuggestions}
                getOptionValue={({ label }) => label}
                onChange={(option) => {
                  handleSelect(option);
                  onChange(option?.label);
                }}
              />
            )}
          />}
        </div>
      </div>
      <div>
        <label
          htmlFor='street_address'
          className={clsx(
            'block text-sm font-medium ',
            addressFields.street_addressError ? 'text-orange-700' : 'text-gray-700'
          )}
        >
          Street Address
        </label>
        <div className='mt-1'>
          <input
            type='text'
            className={clsx(
              addressFields.street_addressError &&
                'text-orange-700 border-orange-700'
            )}
            {...register(addressFields.street_addressName, { required: true })}
          />
        </div>
      </div>
      <div className='flex'>
        <div className='w-1/2 '>
          <label
            htmlFor='suburb'
            className={clsx(
              'block text-sm font-medium ',
              addressFields.suburbError ? 'text-orange-700' : 'text-gray-700'
            )}
          >
            Suburb
          </label>
          <div className='mt-1'>
            <input
              type='text'
              className={clsx(
                addressFields.suburbError && 'text-orange-700 border-orange-700'
              )}
              {...register(addressFields.suburbName, { required: true })}
            />
          </div>
        </div>
        <div className='w-1/2 ml-3'>
          <label
            htmlFor='postcode'
            className={clsx(
              'block text-sm font-medium ',
              addressFields.postcodeError ? 'text-orange-700' : 'text-gray-700'
            )}
          >
            Post Code
          </label>
          <div className='mt-1'>
            <input
              type='text'
              id='postcode'
              className={clsx(
                addressFields.postcodeError && 'text-orange-700 border-orange-700'
              )}
              {...register(addressFields.postcodeName, { required: true })}
            />
          </div>
        </div>
      </div>
      <div className='flex'>
        <div className='w-1/2 '>
          <label
            htmlFor='state'
            className={clsx(
              'block text-sm font-medium ',
              addressFields.stateError ? 'text-orange-700' : 'text-gray-700'
            )}
          >
            State
          </label>
          <div className='mt-1'>
            <input
              type='text'
              className={clsx(
                addressFields.stateError && 'text-orange-700 border-orange-700'
              )}
              {...register(addressFields.stateName, { required: true })}
            />
          </div>
        </div>
      </div>
    </>
  );
}
