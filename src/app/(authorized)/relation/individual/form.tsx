'use client';

import clsx from 'clsx';
import { z } from 'zod';
import { useId, useState } from 'react';
import type { MouseEventHandler } from 'react';
import { ImSpinner2 } from 'react-icons/im';
import { FormProvider, useForm } from 'react-hook-form';
import Select, { components } from 'react-select';
import CreatableSelect from 'react-select/creatable';
import { toast } from 'react-toastify';
import type { OptionProps, SingleValue } from 'react-select';
import { TRPCError } from '@trpc/server';
import { useQueryClient } from '@tanstack/react-query';

import { Card, AddressComponent, Button } from '@/components';
import { Label, TextInput } from '@/components/ui';
import { trpc } from '@/server/trpc/client';

type IndividualType = {
  individualName: string;
  relationshipName?: string;
  firstName?: string;
  lastName?: string;
  address: {
    addressLine: string;
    street_address: string;
    suburb: string;
    postcode: string;
    state: string;
  };
};

type IndividualOptionType = {
  value: IndividualType;
  label: string;
  id: string;
};

type RelationshipOptionType = {
  value: string;
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
      className='ml-2 cursor-pointer text-red-500 hover:text-red-700'
      onClick={props.onClick}
      aria-label='Delete individual'
    >
      <svg
        className='h-4 w-4'
        fill='none'
        stroke='currentColor'
        viewBox='0 0 24 24'
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth={2}
          d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
        />
      </svg>
    </div>
  );
}

const Option = (props: OptionProps<IndividualOptionType, false>) => {
  const queryClient = useQueryClient();
  const { isPending, mutate: deleteIndividual } =
    trpc.individual.removeIndividualDetails.useMutation({
      onSuccess() {
        queryClient.refetchQueries({
          queryKey: [['individual', 'getAllIndividuals']],
        });
        toast('Individual details deleted successfully', {
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
        <DeleteIcon
          onClick={() => deleteIndividual({ individualId: props.data.id })}
        />
      )}
    </div>
  );
};

export default function IndividualForm() {
  const queryClient = useQueryClient();
  const getIndividualsQuery = trpc.individual.getAllIndividuals.useQuery();
  const getRelationshipsQuery = trpc.individual.getAllRelationships.useQuery();

  const saveIndividualDetailsMutation =
    trpc.individual.saveIndividualDetails.useMutation({
      onError(error: unknown) {
        if (error instanceof TRPCError) {
          toast.error(error.message);
        }
      },

      onSuccess() {
        queryClient.refetchQueries({
          queryKey: [['individual', 'getAllIndividuals']],
        });
        queryClient.refetchQueries({
          queryKey: [['individual', 'getAllRelationships']],
        });
        toast.success('Individual details saved!');
      },
    });

  const uniqSelectIndividualId = useId();
  const uniqSelectRelationshipId = useId();
  const [selectedIndividual, setSelectedIndividual] = useState<
    SingleValue<IndividualOptionType> | undefined
  >();

  const formMethods = useForm<IndividualType>({
    mode: 'onBlur',
    defaultValues: {
      individualName: '',
      relationshipName: '',
      firstName: '',
      lastName: '',
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
    formFieldSetValue('individualName', '');
    formFieldSetValue('relationshipName', '');
    formFieldSetValue('firstName', '');
    formFieldSetValue('lastName', '');
    formFieldSetValue('address.addressLine', '');
    formFieldSetValue('address.street_address', '');
    formFieldSetValue('address.suburb', '');
    formFieldSetValue('address.postcode', '');
    formFieldSetValue('address.state', '');
    setSelectedIndividual(null);
  };

  const submitHandler = (formData: IndividualType) => {
    const {
      individualName,
      relationshipName,
      firstName,
      lastName,
      address: { addressLine, postcode, state, street_address, suburb },
    } = formData;

    saveIndividualDetailsMutation.mutate({
      name: individualName,
      relationshipName: relationshipName || undefined,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      addressLine,
      postcode: postcode ? postCodeSchema.parse(postcode) : undefined,
      state,
      streetAddress: street_address,
      suburb,
    });
    resetForm();
  };

  const handleOptionChange = (option: SingleValue<IndividualOptionType>) => {
    if (!option) {
      resetForm();
      return;
    }

    if (option.value) {
      formFieldSetValue('individualName', option.value.individualName);
      formFieldSetValue(
        'relationshipName',
        option.value.relationshipName || '',
      );
      formFieldSetValue('firstName', option.value.firstName || '');
      formFieldSetValue('lastName', option.value.lastName || '');
      setSelectedIndividual(option);
    }
    return;
  };

  if (getIndividualsQuery.error) {
    toast.error(getIndividualsQuery.error.message);
  }

  // Transform individuals for dropdown
  let individualOptions: Array<IndividualOptionType> = [];
  if (getIndividualsQuery.isSuccess && getIndividualsQuery.data) {
    individualOptions = getIndividualsQuery.data.map((individual: any) => ({
      id: individual.id,
      label: individual.name,
      value: {
        individualName: individual.name,
        relationshipName: individual.relationship?.name || '',
        firstName: individual.firstName || '',
        lastName: individual.lastName || '',
        address: {
          addressLine: individual.addressLine || '',
          postcode: String(individual.postcode || ''),
          state: individual.state || '',
          street_address: individual.streetAddress || '',
          suburb: individual.suburb || '',
        },
      },
    }));
  }

  // Transform relationships for dropdown
  let relationshipOptions: Array<RelationshipOptionType> = [];
  if (getRelationshipsQuery.isSuccess && getRelationshipsQuery.data) {
    relationshipOptions = getRelationshipsQuery.data.map(
      (relationship: any) => ({
        id: relationship.id,
        label: relationship.name,
        value: relationship.name,
      }),
    );
  }

  return (
    <Card>
      <Card.Header>
        <div className='flex justify-between text-left'>
          <Card.Header.Title>Individual Details</Card.Header.Title>
        </div>
      </Card.Header>

      <Card.Body>
        <FormProvider {...formMethods}>
          <form
            className='mb-0 space-y-6'
            onSubmit={handleSubmit(submitHandler)}
          >
            <div>
              <Label htmlFor='individual'>Individual</Label>
              <div className='mt-1'>
                <Select
                  isClearable
                  className='w-full max-w-md'
                  components={{ Option }}
                  value={selectedIndividual}
                  options={individualOptions}
                  instanceId={uniqSelectIndividualId}
                  getOptionValue={(option) => option.id}
                  onChange={(option) => handleOptionChange(option)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor='individualName' error={!!errors.individualName}>
                Individual Name
              </Label>
              <div className='mt-1'>
                <TextInput
                  id='individualName'
                  type='text'
                  error={!!errors.individualName}
                  {...register('individualName', { required: true })}
                />
              </div>
            </div>

            <div>
              <Label
                htmlFor='relationshipName'
                error={!!errors.relationshipName}
              >
                Relationship
              </Label>
              <div className='mt-1'>
                <CreatableSelect
                  isClearable
                  className='w-full max-w-md'
                  options={relationshipOptions}
                  instanceId={uniqSelectRelationshipId}
                  getOptionValue={(option) => option.id}
                  placeholder='Select or type a relationship...'
                  onInputChange={(inputValue, { action }) => {
                    if (action === 'input-change') {
                      formFieldSetValue('relationshipName', inputValue);
                    }
                  }}
                  onChange={(option) => {
                    formFieldSetValue('relationshipName', option?.value || '');
                  }}
                  formatCreateLabel={(inputValue: string) =>
                    `Create "${inputValue}"`
                  }
                />
              </div>
              <p className='mt-1 text-xs text-gray-500'>
                Select from existing relationships or type a new one (e.g.,
                Mother, Father, Friend, Spouse)
              </p>
            </div>

            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <div>
                <Label htmlFor='firstName' error={!!errors.firstName}>
                  First Name (Optional)
                </Label>
                <div className='mt-1'>
                  <TextInput
                    id='firstName'
                    type='text'
                    error={!!errors.firstName}
                    {...register('firstName')}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor='lastName' error={!!errors.lastName}>
                  Last Name (Optional)
                </Label>
                <div className='mt-1'>
                  <TextInput
                    id='lastName'
                    type='text'
                    error={!!errors.lastName}
                    {...register('lastName')}
                  />
                </div>
              </div>
            </div>

            <AddressComponent<IndividualType>
              basePropertyName='address'
              address={selectedIndividual?.value.address}
              required={false} // Address fields are optional for individuals
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
                isLoading={saveIndividualDetailsMutation.isPending}
                variant='primary'
                type='submit'
              >
                {selectedIndividual ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </FormProvider>
      </Card.Body>
    </Card>
  );
}
