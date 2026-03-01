'use client';

import clsx from 'clsx';
import { z } from 'zod';
import { useId, useState } from 'react';
import type { MouseEventHandler } from 'react';
import { ImSpinner2 } from 'react-icons/im';
import { FormProvider, useForm } from 'react-hook-form';
import Select, { components } from 'react-select';
import { toast } from 'react-toastify';
import type { OptionProps, SingleValue, GroupBase } from 'react-select';
import { TRPCError } from '@trpc/server';
import { useQueryClient } from '@tanstack/react-query';

import { Card, AddressComponent, Button } from '@/components';
import { Label, TextInput } from '@/components/ui';
import { trpc } from '@/server/trpc/client';
import { BusinessEnumType } from '@/types/enum';

type BusinessType = {
  businessName: string;
  type: BusinessEnumType;
  address: {
    addressLine: string;
    street_address: string;
    suburb: string;
    postcode: string;
    state: string;
  };
};

type BusinessOptionType = {
  value: BusinessType;
  label: string;
  id: string;
};

const AU_STATE_CODES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

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

// React 19 type compatibility wrapper for react-select Option
const BaseOption = components.Option as React.ComponentType<
  OptionProps<BusinessOptionType, false, GroupBase<BusinessOptionType>>
>;

const Option = (
  props: OptionProps<BusinessOptionType, false>,
): React.JSX.Element => {
  const queryClient = useQueryClient();
  const { isPending, mutate: deleteBusiness } =
    trpc.business.removeBusinessDetails.useMutation({
      onSuccess() {
        queryClient.refetchQueries({
          queryKey: [['business', 'getAllBusinesses']],
        });
        toast('Business details deleted successfully', {
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
      <BaseOption {...props} />
      {isPending ? (
        <ImSpinner2 className='animate-spin' />
      ) : (
        <DeleteIcon
          onClick={() => deleteBusiness({ businessId: props.data.id })}
        />
      )}
    </div>
  );
};

export default function BusinessForm() {
  const queryClient = useQueryClient();
  const getBusinessesQuery = trpc.business.getAllBusinesses.useQuery();
  const saveBusinessDetailsMutation =
    trpc.business.saveBusinessDetails.useMutation({
      onError(error: unknown) {
        if (error instanceof TRPCError) {
          toast.error(error.message);
        }
      },

      onSuccess() {
        queryClient.refetchQueries({
          queryKey: [['business', 'getAllBusinesses']],
        });
        toast.success('Business details saved!');
      },
    });

  const uniqSelectBusinessId = useId();
  const [selectedBusiness, setSelectedBusiness] = useState<
    SingleValue<BusinessOptionType> | undefined
  >();

  const formMethods = useForm<BusinessType>({
    mode: 'onBlur',
    defaultValues: {
      businessName: '',
      type: BusinessEnumType.BANK,
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
    formFieldSetValue('businessName', '');
    formFieldSetValue('type', BusinessEnumType.BANK);
    setSelectedBusiness(null);
  };

  const submitHandler = (formData: BusinessType) => {
    const {
      businessName,
      type,
      address: { addressLine, postcode, state, street_address, suburb },
    } = formData;

    saveBusinessDetailsMutation.mutate({
      name: businessName,
      type,
      addressLine,
      postcode: postCodeSchema.parse(postcode),
      state,
      streetAddress: street_address,
      suburb,
    });
    resetForm();
  };

  const handleOptionChange = (option: SingleValue<BusinessOptionType>) => {
    if (!option) {
      resetForm();
      return;
    }

    if (option.value) {
      formFieldSetValue('businessName', option.value.businessName);
      formFieldSetValue('type', option.value.type);
      setSelectedBusiness(option);
    }
    return;
  };

  if (getBusinessesQuery.error) {
    toast.error(getBusinessesQuery.error.message);
  }

  let businessOptions: Array<BusinessOptionType> = [];
  if (getBusinessesQuery.isSuccess && getBusinessesQuery.data) {
    businessOptions = getBusinessesQuery.data.map((o) => ({
      id: o.id,
      label: o.name,
      value: {
        businessName: o.name,
        type: (o.type as BusinessEnumType) || BusinessEnumType.BANK,
        address: {
          addressLine: o.addressLine || '',
          postcode: String(o.postcode || ''),
          state: o.state || '',
          street_address: o.streetAddress || '',
          suburb: o.suburb || '',
        },
      },
    }));
  }

  return (
    <Card>
      <Card.Header>
        <div className='flex justify-between text-left'>
          <Card.Header.Title>Business Details</Card.Header.Title>
        </div>
      </Card.Header>

      <Card.Body>
        <FormProvider {...formMethods}>
          <form
            className='mb-0 space-y-6'
            onSubmit={handleSubmit(submitHandler)}
          >
            <div>
              <Label htmlFor='business'>Business</Label>
              <div className='mt-1'>
                <Select
                  isClearable
                  className='w-full max-w-md'
                  components={{ Option }}
                  value={selectedBusiness}
                  options={businessOptions}
                  instanceId={uniqSelectBusinessId}
                  getOptionValue={(option) => option.id}
                  onChange={(option) => handleOptionChange(option)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor='businessName' error={!!errors.businessName}>
                Business Name
              </Label>
              <div className='mt-1'>
                <TextInput
                  id='businessName'
                  type='text'
                  error={!!errors.businessName}
                  {...register('businessName', { required: true })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor='type' error={!!errors.type}>
                Business Type
              </Label>
              <div className='mt-1'>
                <select
                  id='type'
                  className={clsx(
                    'block w-full max-w-md px-3 py-2 text-sm border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500',
                    {
                      'border-red-500 focus:ring-red-500 focus:border-red-500':
                        errors.type,
                    },
                  )}
                  {...register('type', { required: true })}
                >
                  {Object.values(BusinessEnumType).map((val) => (
                    <option key={val} value={val}>
                      {val.charAt(0).toUpperCase() + val.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <AddressComponent<BusinessType>
              basePropertyName='address'
              address={selectedBusiness?.value.address}
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
                isLoading={saveBusinessDetailsMutation.isPending}
                variant='primary'
                type='submit'
              >
                {selectedBusiness ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </FormProvider>
      </Card.Body>
    </Card>
  );
}
