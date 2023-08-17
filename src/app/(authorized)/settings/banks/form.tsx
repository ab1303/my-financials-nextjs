'use client';

import clsx from 'clsx';
import { z } from 'zod';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import Select from 'react-select';
import { toast } from 'react-toastify';
import { TRPCError } from '@trpc/server';
import { trpc } from '@/server/trpc/trpcClient';

import { Card, AddressComponent, Button } from '@/components';
import type { SingleValue } from 'react-select';
import type { BankType } from '@/types';

const postCodeSchema = z.coerce.number({
  required_error: 'Postcode is required',
  invalid_type_error: 'Postcode must be a number',
});

type BankOptionType = {
  value: BankType;
  label: string;
};

export default function BanksForm() {
  const getBanksQuery = trpc.bank.getAllBanks.useQuery();
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

  const [selectedBank, setSelectedBank] = useState<
    SingleValue<BankOptionType> | undefined
  >();

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
    setValue: formFieldSetValue,
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

  const handleOptionChange = (option: SingleValue<BankOptionType>) => {
    if (!option) {
      formFieldSetValue('bankName', '');
      setSelectedBank(null);
      return;
    }

    if (option.value) {
      formFieldSetValue('bankName', option.value.bankName);
      setSelectedBank(option);
    }

    return;
  };

  if (getBanksQuery.error) {
    toast.error(getBanksQuery.error.message);
  }

  let bankOptions: Array<BankOptionType> = [];
  if (getBanksQuery.isSuccess && getBanksQuery.data) {
    bankOptions = getBanksQuery.data.map((o) => ({
      value: {
        bankName: o.name,
        address: {
          addressLine: o.addressLine,
          postcode: String(o.postcode),
          state: o.state,
          street_address: o.streetAddress,
          suburb: o.suburb,
        },
      },
      label: o.name,
    }));
  }

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
            <div>
              <label className={clsx('block text-sm font-medium ')}>Bank</label>
              <div className='mt-1'>
                <Select
                  className='w-3/5 mr-2'
                  value={selectedBank}
                  options={bankOptions}
                  isClearable
                  onChange={(option) => handleOptionChange(option)}
                />
              </div>
            </div>

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
              address={selectedBank?.value.address}
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
