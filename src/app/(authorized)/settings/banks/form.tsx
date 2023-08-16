'use client';

import clsx from 'clsx';
import { z } from 'zod';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { TRPCError } from '@trpc/server';
import { trpc } from '@/server/trpc/trpcClient';

import { Card, AddressComponent, PageLoading, Button } from '@/components';

import type { BankType } from '@/types';

const postCodeSchema = z.coerce.number({
  required_error: 'Postcode is required',
  invalid_type_error: 'Postcode must be a number',
});

export default function BanksForm() {
  const saveBankDetailsMutation = trpc.bank.saveBankDetails.useMutation({
    onError(error: unknown) {
      if (error instanceof TRPCError) {
        toast.error(error.message);
      }
    },

    onSuccess() {
      toast.success('Bank details saved!');
    },
  });

  const formMethods = useForm<BankType>({
    mode: 'onBlur',
    defaultValues: {
      bankName: '',
      address: {
        addressLine: '',
        street_address: '',
        suburb: '',
        postcode: '',
        state: '',
      },
    },
  });

  const {
    register,
    formState: { errors },
    handleSubmit,
  } = formMethods;

  const submitHandler = (formData: BankType) => {
    console.log('Bank Details', formData);

    const {
      bankName,
      address: { addressLine, postcode, state, street_address, suburb },
    } = formData;

    saveBankDetailsMutation.mutate({
      name: bankName,
      addressLine,
      postcode: postCodeSchema.parse(postcode),
      state,
      streetAddress: street_address,
      suburb,
    });
  };

  return (
    <>
      <Card.Header>
        <div className='flex justify-between mt-4 text-left'>
          <Card.Header.Title>Bank Details</Card.Header.Title>
        </div>
      </Card.Header>

      <div className='bg-white shadow mt-4 py-8 px-6 sm:px-10 rounded-lg'>
        <FormProvider {...formMethods}>
          <form
            className='mb-0 space-y-6'
            onSubmit={handleSubmit(submitHandler)}
          >
            {/* <div>
              <label
                className={clsx(
                  'block text-sm font-medium ',
                  errors.restaurantName ? 'text-orange-700' : 'text-gray-700'
                )}
              >
                Cuisine
              </label>
              <div className='mt-1'>
                <Controller
                  name='cuisine'
                  control={control}
                  rules={{
                    required: true,
                  }}
                  render={({ field: { onChange, value } }) => (
                    <Select
                      styles={{
                        control: (base) => ({
                          ...base,
                          borderColor: errors.cuisine && 'rgba(194, 65, 12)',
                        }),
                      }}
                      value={{ label: value }}
                      options={Object.keys(CuisineMap).map((k) => ({
                        label: k,
                      }))}
                      getOptionValue={({ label }) => label}
                      onChange={(option) => {
                        onChange(option?.label || null);
                      }}
                    />
                  )}
                />
              </div>
            </div> */}

            <div>
              <label
                className={clsx(
                  'block text-sm font-medium ',
                  errors.bankName ? 'text-orange-700' : 'text-gray-700'
                )}
              >
                Bank Name
              </label>
              <div className='mt-1'>
                <input
                  type='text'
                  className={clsx(
                    errors.bankName && 'text-orange-700 border-orange-700'
                  )}
                  {...register('bankName', { required: true })}
                />
              </div>
            </div>

            <AddressComponent<BankType>
              basePropertyName='address'
              addressFields={{
                addressLineName: 'address.addressLine',
                postcodeName: 'address.postcode',
                stateName: 'address.state',
                street_addressName: 'address.street_address',
                suburbName: 'address.suburb',
                addressLineError: errors.address?.addressLine,
                suburbError: errors.address?.suburb,
                postcodeError: errors.address?.postcode,
                stateError: errors.address?.state,
                street_addressError: errors.address?.street_address,
              }}
            />

            <div>
              <Button
                isLoading={saveBankDetailsMutation.isLoading}
                variant='primary'
                type='submit'
              >
                Create
              </Button>
            </div>
          </form>
        </FormProvider>
      </div>
    </>
  );
}
