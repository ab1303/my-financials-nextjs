'use client';

import clsx from 'clsx';
import { z } from 'zod';
import { useId, useState } from 'react';
import type { MouseEventHandler } from 'react';
import { ImSpinner2 } from 'react-icons/im';
import { FormProvider, useForm } from 'react-hook-form';
import Select, { components } from 'react-select';
import { toast } from 'react-toastify';
import type { OptionProps, SingleValue } from 'react-select';
import { TRPCError } from '@trpc/server';
import { useQueryClient } from '@tanstack/react-query';

import { Card, AddressComponent, Button } from '@/components';
import { Label } from '@/components/ui/Label';
import { TextInput } from '@/components/ui/TextInput';
import { trpc } from '@/server/trpc/client';
import type { BankType } from '@/types';

type BankOptionType = {
  value: BankType;
  label: string;
  id: string;
};

const postCodeSchema = z.coerce.number({
  required_error: 'Postcode is required',
  invalid_type_error: 'Postcode must be a number',
});

type DeleteIconProps = {
  onClick: MouseEventHandler<HTMLDivElement>;
};

function DeleteIcon(props: DeleteIconProps) {
  return (
    <div
      className='flex items-center hover:cursor-pointer hover:text-orange-700'
      onClick={props.onClick}
    >
      <svg
        className='mx-2 h-4 w-4 border-b-2 border-b-orange-700'
        fill='currentColor'
        viewBox='0 0 20 20'
        xmlns='http://www.w3.org/2000/svg'
      >
        <path
          fillRule='evenodd'
          d='M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z'
          clipRule='evenodd'
        ></path>
      </svg>
    </div>
  );
}

const Option = (props: OptionProps<BankOptionType, false>) => {
  const queryClient = useQueryClient();
  const { isPending, mutate: deleteBank } =
    trpc.bank.removeBankDetails.useMutation({
      onSuccess() {
        queryClient.refetchQueries({ queryKey: [['getAllBanks']] });
        toast('Bank details deleted successfully', {
          type: 'success',
          position: 'top-right',
        });
      },
      onError(error) {
        toast(error.message, {
          type: 'error',
          position: 'top-right',
        });
      },
    });

  return (
    <div className='flex justify-between'>
      <components.Option {...props} />
      {isPending ? (
        <ImSpinner2 className='animate-spin' />
      ) : (
        <DeleteIcon onClick={() => deleteBank({ bankId: props.data.id })} />
      )}
    </div>
  );
};

export default function BanksForm() {
  const queryClient = useQueryClient();
  const getBanksQuery = trpc.bank.getAllBanks.useQuery();
  const saveBankDetailsMutation = trpc.bank.saveBankDetails.useMutation({
    onError(error: unknown) {
      if (error instanceof TRPCError) {
        toast.error(error.message);
      }
    },

    onSuccess() {
      queryClient.refetchQueries({ queryKey: [['getAllBanks']] });
      toast.success('Bank details saved!');
    },
  });

  const uniqSelectBankId = useId();
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

  const resetForm = () => {
    formFieldSetValue('bankName', '');
    setSelectedBank(null);
  };

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
    resetForm();
  };

  const handleOptionChange = (option: SingleValue<BankOptionType>) => {
    if (!option) {
      resetForm();
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
      id: o.id,
      label: o.name,
      value: {
        bankName: o.name,
        address: {
          addressLine: o.addressLine || '',
          postcode: String(o.postcode),
          state: o.state || '',
          street_address: o.streetAddress || '',
          suburb: o.suburb || '',
        },
      },
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
              <Label htmlFor='bank'>Bank</Label>
              <div className='mt-1'>
                <Select
                  isClearable
                  className='w-3/5 mr-2'
                  components={{ Option }}
                  value={selectedBank}
                  options={bankOptions}
                  instanceId={uniqSelectBankId}
                  getOptionValue={(option) => option.id}
                  onChange={(option) => handleOptionChange(option)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor='bankName' error={!!errors.bankName}>
                Bank Name
              </Label>
              <div className='mt-1'>
                <TextInput
                  id='bankName'
                  type='text'
                  error={!!errors.bankName}
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
                isLoading={saveBankDetailsMutation.isPending}
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
