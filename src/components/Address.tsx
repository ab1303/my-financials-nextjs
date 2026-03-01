'use client';

import * as React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import AsyncSelect from 'react-select/async';
import Select from 'react-select';
import { useDebouncedCallback } from 'use-debounce';
import usePlacesAutocomplete, { getGeocode } from 'use-places-autocomplete';
import clsx from 'clsx';

import type { Options, SingleValue } from 'react-select';
import type { FieldError, FieldValues } from 'react-hook-form';

import { Label } from '@/components/ui/Label';
import { TextInput } from '@/components/ui/TextInput';
import type { Address, FilteredKeys } from '@/types';
import { inputStyles } from '@/styles/theme';
import { useId } from 'react';

const debounce = 300;
const minLengthAutocomplete = 3;
const selectProps = {
  isClearable: true,
};

type AddressPropertyNames<TAddressSuper> = FilteredKeys<TAddressSuper, Address>;

type AddressFields<T> = {
  [P in keyof Address as `${P}Name`]: `${string & AddressPropertyNames<T>}.${P}`;
} & { [P in keyof Address as `${P}Error`]: FieldError | undefined };

interface Props<T extends FieldValues> {
  basePropertyName: AddressPropertyNames<T>;
  addressFields: AddressFields<T>;
  address?: Address;
  required?: boolean; // Whether address fields are required (default: true for backwards compatibility)
  addressFormat?: 'AU' | 'GLOBAL'; // Address format selector
  onAddressFormatChange?: (format: 'AU' | 'GLOBAL') => void; // Callback for format changes
}

export default function AddressComponent<T extends FieldValues>({
  addressFields,
  address,
  required = true, // Default to true to maintain existing behavior for Business entities
  addressFormat = 'AU', // Default to AU for backward compatibility
  onAddressFormatChange,
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

  const setAddressFields = React.useCallback(
    (address: Address) => {
      formFieldSetValue(
        String(addressFields.addressLineName),
        address.addressLine,
      );
      formFieldSetValue(
        String(addressFields.street_addressName),
        address.street_address,
      );
      formFieldSetValue(String(addressFields.suburbName), address.suburb);
      formFieldSetValue(String(addressFields.postcodeName), address.postcode);
      formFieldSetValue(String(addressFields.stateName), address.state);
    },
    [addressFields, formFieldSetValue],
  );

  React.useEffect(() => {
    if (!address) {
      setAddressFields({
        addressLine: '',
        street_address: '',
        postcode: '',
        state: '',
        suburb: '',
      });
      return;
    }

    const { addressLine, postcode, state, street_address, suburb } = address;
    setAddressFields({
      addressLine,
      street_address,
      postcode,
      state,
      suburb,
    });
  }, [address, setAddressFields]);

  const fetchSuggestions = useDebouncedCallback(
    React.useCallback(
      (
        value: string,
        cb: (options: Options<{ label: string }>) => void,
      ): void => {
        if (value.length < minLengthAutocomplete) return cb([]);

        addressAutoCompleteSetValue(value);
        cb(
          (data || []).map((suggestion) => ({
            label: suggestion.description,
            value: suggestion,
          })),
        );
      },
      [data, addressAutoCompleteSetValue],
    ),
    debounce,
  );

  const handleSelect = (selectedOption: SingleValue<{ label: string }>) => {
    // Loop like an Array
    if (!selectedOption) {
      setAddressFields({
        addressLine: '',
        postcode: '',
        state: '',
        street_address: '',
        suburb: '',
      });
      return;
    }

    // Get latitude and longitude via utility functions
    getGeocode({ address: selectedOption?.label })
      .then((results) => {
        if (!results.length || !results[0]) return;

        const addressComponents = results[0].address_components;
        const streetAddressNumber = addressComponents.find((c) =>
          c.types.includes('street_number'),
        )?.long_name;

        const streetAddress = addressComponents.find((c) =>
          c.types.includes('route'),
        )?.long_name;

        const suburb = addressComponents.find((c) =>
          c.types.includes('locality'),
        )?.long_name;

        const state = addressComponents.find((c) =>
          c.types.includes('administrative_area_level_1'),
        )?.long_name;

        const postalcode = addressComponents.find((c) =>
          c.types.includes('postal_code'),
        )?.long_name;

        setAddressFields({
          street_address: `${streetAddressNumber || ''} ${streetAddress}`,
          addressLine: suburb || '',
          suburb: suburb || '',
          postcode: postalcode || '',
          state: state || '',
        });
      })
      .catch(() => {
        // console.log('😱 Error: ', error);
      });
  };

  return (
    <>
      {/* Country/Address Format Selector */}
      {onAddressFormatChange && (
        <div className='mb-4'>
          <Label>Address Format</Label>
          <div className='mt-1'>
            <Select
              instanceId={`${uniqId}-format`}
              value={{
                value: addressFormat,
                label: addressFormat === 'AU' ? 'Australia' : 'Global',
              }}
              options={[
                { value: 'AU' as const, label: 'Australia' },
                { value: 'GLOBAL' as const, label: 'Global' },
              ]}
              onChange={(option) => {
                if (option?.value) {
                  onAddressFormatChange(option.value);
                }
              }}
              isClearable={false}
              isSearchable={false}
            />
          </div>
        </div>
      )}

      {/* Conditional rendering based on address format */}
      {addressFormat === 'AU' ? (
        // Australian Address Fields
        <>
          <div>
            <Label error={!!addressFields.addressLineError}>Address</Label>
            <div className='mt-1'>
              {ready && (
                <Controller
                  name={String(addressFields.addressLineName)}
                  control={control}
                  rules={{
                    required: required,
                  }}
                  render={({ field: { onChange, value } }) => (
                    <AsyncSelect
                      instanceId={uniqId}
                      {...selectProps}
                      styles={{
                        control: (base) =>
                          ({
                            ...base,
                            borderColor:
                              addressFields.addressLineError &&
                              'rgba(194, 65, 12)',
                          }) as typeof base,
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
                />
              )}
            </div>
          </div>
          <div>
            <Label
              htmlFor={addressFields.street_addressName}
              error={!!addressFields.street_addressError}
            >
              Street Address
            </Label>
            <div className='mt-1'>
              <TextInput
                id={addressFields.street_addressName}
                type='text'
                error={!!addressFields.street_addressError}
                {...register(addressFields.street_addressName, {
                  required: required,
                })}
              />
            </div>
          </div>
          <div className='flex'>
            <div className='w-1/2 '>
              <Label
                htmlFor={addressFields.suburbName}
                error={!!addressFields.suburbError}
              >
                Suburb
              </Label>
              <div className='mt-1'>
                <TextInput
                  id={addressFields.suburbName}
                  type='text'
                  error={!!addressFields.suburbError}
                  {...register(addressFields.suburbName, {
                    required: required,
                  })}
                />
              </div>
            </div>
            <div className='w-1/2 ml-3'>
              <Label
                htmlFor={addressFields.postcodeName}
                error={!!addressFields.postcodeError}
              >
                Post Code
              </Label>
              <div className='mt-1'>
                <TextInput
                  id={addressFields.postcodeName}
                  type='text'
                  error={!!addressFields.postcodeError}
                  {...register(addressFields.postcodeName, {
                    required: required,
                  })}
                />
              </div>
            </div>
          </div>
          <div className='flex'>
            <div className='w-1/2 '>
              <Label
                htmlFor={addressFields.stateName}
                error={!!addressFields.stateError}
              >
                State
              </Label>
              <div className='mt-1'>
                <TextInput
                  type='text'
                  id={addressFields.stateName}
                  error={!!addressFields.stateError}
                  {...register(addressFields.stateName, { required: required })}
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        // Global Address Field - stored in addressLine
        <div>
          <Label
            htmlFor={addressFields.addressLineName}
            error={!!addressFields.addressLineError}
          >
            Address
          </Label>
          <div className='mt-1'>
            <textarea
              id={addressFields.addressLineName}
              rows={4}
              className={clsx(
                inputStyles.base,
                addressFields.addressLineError && inputStyles.error,
                'resize-none', // Prevent resizing to maintain consistent layout
              )}
              placeholder='Enter the complete address...'
              {...register(addressFields.addressLineName, {
                required: required,
              })}
            />
          </div>
        </div>
      )}
    </>
  );
}
