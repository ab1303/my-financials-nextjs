'use client';

import { useQueryClient } from '@tanstack/react-query';
import { TRPCError } from '@trpc/server';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import { useId, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import type { GroupBase, OptionProps, SingleValue } from 'react-select';
import { components } from 'react-select';
import { toast } from 'sonner';
import { z } from 'zod';

import { AddressComponent, Button, Card } from '@/components';
import { Label, TextInput } from '@/components/ui';
import {
  DeletableOption,
  SelectWrapper as Select,
} from '@/components/ui/Select';
import { trpc } from '@/server/trpc/client';
import { BusinessEnumType } from '@/types/enum';

type BusinessType = {
  businessName: string;
  type: BusinessEnumType;
  isDgrRegistered: boolean;
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
        toast.success('Business details deleted successfully');
      },
      onError(error) {
        toast.error(error.message);
      },
    });

  return (
    <DeletableOption
      {...props}
      isPending={isPending}
      onDelete={() => deleteBusiness({ businessId: props.data.id })}
    />
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

  const updateBusinessDetailsMutation =
    trpc.business.updateBusinessDetails.useMutation({
      onError(error: unknown) {
        if (error instanceof TRPCError) {
          toast.error(error.message);
        }
      },

      onSuccess() {
        queryClient.refetchQueries({
          queryKey: [['business', 'getAllBusinesses']],
        });
        toast.success('Business details updated!');
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
      isDgrRegistered: false,
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
    formFieldSetValue('isDgrRegistered', false);
    setSelectedBusiness(null);
  };

  const submitHandler = (formData: BusinessType) => {
    const {
      businessName,
      type,
      isDgrRegistered,
      address: { addressLine, postcode, state, street_address, suburb },
    } = formData;
    const resolvedIsDgrRegistered =
      type === BusinessEnumType.PHILANTHROPY ? isDgrRegistered : false;

    if (selectedBusiness) {
      // Update existing business
      updateBusinessDetailsMutation.mutate(
        {
          id: selectedBusiness.id,
          name: businessName,
          isDgrRegistered: resolvedIsDgrRegistered,
          addressLine,
          postcode: postcode ? postCodeSchema.parse(postcode) : undefined,
          state,
          streetAddress: street_address,
          suburb,
        },
        {
          onSuccess: () => {
            // Don't reset form for updates — keep updated data visible
          },
        },
      );
    } else {
      // Create new business
      saveBusinessDetailsMutation.mutate({
        name: businessName,
        type,
        isDgrRegistered: resolvedIsDgrRegistered,
        addressLine,
        postcode: postCodeSchema.parse(postcode),
        state,
        streetAddress: street_address,
        suburb,
      });
      resetForm();
    }
  };

  const handleOptionChange = (option: SingleValue<BusinessOptionType>) => {
    if (!option) {
      resetForm();
      return;
    }

    if (option.value) {
      formFieldSetValue('businessName', option.value.businessName);
      formFieldSetValue('type', option.value.type);
      formFieldSetValue(
        'isDgrRegistered',
        option.value.isDgrRegistered ?? false,
      );
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
        isDgrRegistered: o.isDgrRegistered ?? false,
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
            <div className='grid grid-cols-1 gap-6'>
              <div>
                <Label htmlFor='business'>Business</Label>
                <div className='mt-2'>
                  <Select<BusinessOptionType>
                    isClearable
                    className='w-full'
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
                <div className='mt-2'>
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
                <div className='mt-2'>
                  <select
                    id='type'
                    className={clsx(
                      'block w-full px-3 py-2 text-sm border border-input bg-background text-foreground rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary',
                      {
                        'border-destructive focus:ring-destructive focus:border-destructive':
                          errors.type,
                      },
                    )}
                    {...register('type', { required: true })}
                  >
                    {Object.values(BusinessEnumType).map((val) => (
                      <option key={val} value={val}>
                        {val.charAt(0).toUpperCase() +
                          val.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {formMethods.watch('type') === BusinessEnumType.PHILANTHROPY ? (
                <div className='rounded-lg border border-border bg-muted/40 px-4 py-3'>
                  <div className='flex items-start gap-3'>
                    <input
                      id='isDgrRegistered'
                      type='checkbox'
                      className='mt-1 h-4 w-4 rounded border-input text-primary focus:ring-primary'
                      {...register('isDgrRegistered')}
                    />
                    <div>
                      <Label
                        htmlFor='isDgrRegistered'
                        className='cursor-pointer'
                      >
                        Tax deductible (DGR registered)
                      </Label>
                      <p className='mt-1 text-sm text-muted-foreground'>
                        Payments to this business will be marked deductible when
                        this is enabled.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className='text-sm text-muted-foreground'>
                  Tax deductibility only applies to philanthropic businesses.
                </p>
              )}
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
                isLoading={
                  saveBusinessDetailsMutation.isPending ||
                  updateBusinessDetailsMutation.isPending
                }
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
