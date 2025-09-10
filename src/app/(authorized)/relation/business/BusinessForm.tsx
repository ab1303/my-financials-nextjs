'use client';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BusinessEnumType } from '@/types/enum';
import Address from '@/components/Address';
import { z } from 'zod';
import { trpc } from '@/server/trpc/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';

const businessSchema = z.object({
  name: z
    .string()
    .min(1, 'Business name is required')
    .max(150, 'Business name must be 150 characters or less'),
  type: z.nativeEnum(BusinessEnumType, {
    errorMap: () => ({ message: 'Business type is required' }),
  }),
  addressLine: z.string().min(1, 'Address line is required'),
  streetAddress: z.string().min(1, 'Street address is required'),
  suburb: z.string().min(1, 'Suburb is required'),
  postcode: z.string().regex(/^\d{4}$/, 'Postcode must be 4 digits'),
  state: z.string().min(1, 'State is required'),
});

type BusinessFormFields = z.infer<typeof businessSchema>;

export default function BusinessForm() {
  const queryClient = useQueryClient();
  const saveBusinessMutation = trpc.business.saveBusinessDetails.useMutation({
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: [['business.getAllBusinesses']] });
      toast.success('Business created!');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to create business');
    },
  });

  const methods = useForm<BusinessFormFields>({
    resolver: zodResolver(businessSchema),
    defaultValues: {
      name: '',
      type: undefined,
      addressLine: '',
      streetAddress: '',
      suburb: '',
      postcode: '',
      state: '',
    },
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = methods;

  const onSubmit = (data: BusinessFormFields) => {
    saveBusinessMutation.mutate({
      ...data,
      postcode: Number(data.postcode),
    });
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className='space-y-4 max-w-lg'>
        <div>
          <label htmlFor='name' className='block font-medium'>
            Business Name
          </label>
          <input
            id='name'
            type='text'
            maxLength={150}
            {...register('name')}
            className='input input-bordered w-full'
            required
          />
          {errors.name && (
            <div className='text-red-500'>{errors.name.message}</div>
          )}
        </div>
        <div>
          <label htmlFor='type' className='block font-medium'>
            Type
          </label>
          <select
            id='type'
            {...register('type')}
            className='select select-bordered w-full'
            required
          >
            <option value=''>Select type</option>
            {Object.values(BusinessEnumType).map((val) => (
              <option key={val} value={val}>
                {val}
              </option>
            ))}
          </select>
          {errors.type && (
            <div className='text-red-500'>{errors.type.message}</div>
          )}
        </div>
        <Address
          basePropertyName={'' as any}
          addressFields={{
            addressLineName: 'addressLine' as any,
            street_addressName: 'streetAddress' as any,
            suburbName: 'suburb' as any,
            postcodeName: 'postcode' as any,
            stateName: 'state' as any,
            addressLineError: errors.addressLine,
            street_addressError: errors.streetAddress,
            suburbError: errors.suburb,
            postcodeError: errors.postcode,
            stateError: errors.state,
          }}
        />
        <button
          type='submit'
          className='btn btn-primary'
          disabled={saveBusinessMutation.isPending}
        >
          {saveBusinessMutation.isPending ? 'Adding...' : 'Add Business'}
        </button>
        {saveBusinessMutation.error && (
          <div className='text-red-500'>
            {saveBusinessMutation.error.message}
          </div>
        )}
      </form>
    </FormProvider>
  );
}
