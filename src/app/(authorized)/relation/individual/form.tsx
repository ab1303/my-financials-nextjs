'use client';

import { useQueryClient } from '@tanstack/react-query';
import { TRPCError } from '@trpc/server';
import { useId, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import type { OptionProps, SingleValue } from 'react-select';
import CreatableSelect from 'react-select/creatable';
import { toast } from 'sonner';
import { z } from 'zod';

import { AddressComponent, Button, Card } from '@/components';
import { Label, TextInput } from '@/components/ui';
import {
  DeletableOption,
  SelectWrapper as Select,
} from '@/components/ui/Select';
import { getSelectStyles } from '@/lib/select-styles';
import { trpc } from '@/server/trpc/client';

type IndividualType = {
  individualName: string;
  relationshipName?: string;
  firstName?: string;
  lastName?: string;
  address: {
    addressLocation?: 'AU' | 'GLOBAL';
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

const Option = (
  props: OptionProps<IndividualOptionType, false>,
): React.JSX.Element => {
  const queryClient = useQueryClient();
  const { isPending, mutate: deleteIndividual } =
    trpc.individual.removeIndividualDetails.useMutation({
      onSuccess() {
        queryClient.refetchQueries({
          queryKey: [['individual', 'getAllIndividuals']],
        });
        toast.success('Individual details deleted successfully');
      },
      onError(error) {
        toast.error(error.message);
      },
    });

  return (
    <DeletableOption
      {...props}
      isPending={isPending}
      onDelete={() => deleteIndividual({ individualId: props.data.id })}
    />
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

  const updateIndividualDetailsMutation =
    trpc.individual.updateIndividualDetails.useMutation({
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
        toast.success('Individual details updated!');
      },
    });

  const uniqSelectIndividualId = useId();
  const uniqSelectRelationshipId = useId();
  const [selectedIndividual, setSelectedIndividual] = useState<
    SingleValue<IndividualOptionType> | undefined
  >();
  const [selectedRelationship, setSelectedRelationship] = useState<
    SingleValue<RelationshipOptionType> | undefined
  >();
  const [addressFormat, setAddressFormat] = useState<'AU' | 'GLOBAL'>('AU');

  const formMethods = useForm<IndividualType>({
    mode: 'onBlur',
    defaultValues: {
      individualName: '',
      relationshipName: '',
      firstName: '',
      lastName: '',
      address: {
        addressLocation: 'AU',
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
    formFieldSetValue('address.addressLocation', 'AU');
    formFieldSetValue('address.addressLine', '');
    formFieldSetValue('address.street_address', '');
    formFieldSetValue('address.suburb', '');
    formFieldSetValue('address.postcode', '');
    formFieldSetValue('address.state', '');
    setSelectedIndividual(null);
    setSelectedRelationship(null); // Clear relationship selection
    setAddressFormat('AU'); // Reset address format state
  };

  const submitHandler = (formData: IndividualType) => {
    const {
      individualName,
      relationshipName,
      firstName,
      lastName,
      address: {
        addressLocation,
        addressLine,
        postcode,
        state,
        street_address,
        suburb,
      },
    } = formData;

    const commonData = {
      name: individualName,
      relationshipName: relationshipName || undefined,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      addressFormat: addressLocation || 'AU',
      // For GLOBAL format, store the complete address in addressLine
      // For AU format, store individual fields as before
      addressLine: addressLine || undefined,
      postcode:
        addressLocation === 'AU' && postcode
          ? postCodeSchema.parse(postcode)
          : undefined,
      state: addressLocation === 'AU' ? state : undefined,
      streetAddress: addressLocation === 'AU' ? street_address : undefined,
      suburb: addressLocation === 'AU' ? suburb : undefined,
    };

    if (selectedIndividual) {
      // Update existing individual
      updateIndividualDetailsMutation.mutate({
        id: selectedIndividual.id,
        ...commonData,
      });
      // Don't reset form for updates - keep the updated data visible
    } else {
      // Create new individual
      saveIndividualDetailsMutation.mutate(commonData);
      resetForm(); // Only reset form for new creations
    }
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

      // Set the relationship selection if it exists
      if (option.value.relationshipName && relationshipOptions.length > 0) {
        const relationshipOption = relationshipOptions.find(
          (rel) => rel.value === option.value.relationshipName,
        );
        setSelectedRelationship(relationshipOption || null);
      } else {
        setSelectedRelationship(null);
      }

      // Handle address format
      const format = option.value.address.addressLocation || 'AU';
      formFieldSetValue('address.addressLocation', format);
      setAddressFormat(format);

      // Populate address fields based on format
      if (format === 'AU') {
        // For AU format, populate individual fields
        formFieldSetValue(
          'address.addressLine',
          option.value.address.addressLine || '',
        );
        formFieldSetValue(
          'address.street_address',
          option.value.address.street_address || '',
        );
        formFieldSetValue('address.suburb', option.value.address.suburb || '');
        formFieldSetValue(
          'address.postcode',
          option.value.address.postcode || '',
        );
        formFieldSetValue('address.state', option.value.address.state || '');
      } else {
        // For GLOBAL format, the complete address is in addressLine
        formFieldSetValue(
          'address.addressLine',
          option.value.address.addressLine || '',
        );
        // Clear AU-specific fields for global format
        formFieldSetValue('address.street_address', '');
        formFieldSetValue('address.suburb', '');
        formFieldSetValue('address.postcode', '');
        formFieldSetValue('address.state', '');
      }

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    individualOptions = getIndividualsQuery.data.map((individual: any) => ({
      id: individual.id,
      label: individual.name,
      value: {
        individualName: individual.name,
        relationshipName: individual.relationship?.name || '',
        firstName: individual.firstName || '',
        lastName: individual.lastName || '',
        address: {
          addressLocation: individual.addressFormat || 'AU',
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    relationshipOptions = getRelationshipsQuery.data.map((relationship: any) => ({
        id: relationship.id,
        label: relationship.name,
        value: relationship.name,
      }));
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
            <div className='grid grid-cols-1 gap-6'>
              <div>
                <Label htmlFor='individual'>Individual</Label>
                <div className='mt-2'>
                  <Select<IndividualOptionType>
                    isClearable
                    className='w-full'
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
                <div className='mt-2'>
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
                <div className='mt-2'>
                  <CreatableSelect
                    isClearable
                    className='w-full'
                    options={relationshipOptions}
                    value={selectedRelationship}
                    instanceId={uniqSelectRelationshipId}
                    getOptionValue={(option) => option.id}
                    placeholder='Select or type a relationship...'
                    styles={getSelectStyles<RelationshipOptionType>()}
                    onInputChange={(inputValue, { action }) => {
                      if (action === 'input-change') {
                        formFieldSetValue('relationshipName', inputValue);
                      }
                    }}
                    onChange={(option) => {
                      setSelectedRelationship(option);
                      formFieldSetValue(
                        'relationshipName',
                        option?.value || '',
                      );
                    }}
                    formatCreateLabel={(inputValue: string) =>
                      `Create "${inputValue}"`
                    }
                  />
                </div>
                <p className='mt-2 text-sm text-muted-foreground'>
                  Select from existing relationships or type a new one (e.g.,
                  Mother, Father, Friend, Spouse)
                </p>
              </div>

              <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
                <div>
                  <Label htmlFor='firstName' error={!!errors.firstName}>
                    First Name (Optional)
                  </Label>
                  <div className='mt-2'>
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
                  <div className='mt-2'>
                    <TextInput
                      id='lastName'
                      type='text'
                      error={!!errors.lastName}
                      {...register('lastName')}
                    />
                  </div>
                </div>
              </div>
            </div>

            <AddressComponent<IndividualType>
              basePropertyName='address'
              address={selectedIndividual?.value.address}
              required={false} // Address fields are optional for individuals
              addressFormat={addressFormat}
              onAddressFormatChange={(format) => {
                const previousFormat = addressFormat;
                setAddressFormat(format);
                formFieldSetValue('address.addressLocation', format);
                // Clear opposite format fields when switching
                if (format === 'AU') {
                  // When switching to AU, clear the addressLine if it was previously used for global
                  if (previousFormat === 'GLOBAL') {
                    formFieldSetValue('address.addressLine', '');
                  }
                } else {
                  // When switching to GLOBAL, clear AU-specific fields but keep addressLine
                  formFieldSetValue('address.street_address', '');
                  formFieldSetValue('address.suburb', '');
                  formFieldSetValue('address.postcode', '');
                  formFieldSetValue('address.state', '');
                }
              }}
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
                  saveIndividualDetailsMutation.isPending ||
                  updateIndividualDetailsMutation.isPending
                }
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
