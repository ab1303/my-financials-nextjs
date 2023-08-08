'use client';

import Card from '@/components/card';
import clsx from 'clsx';
import { FormProvider, useForm } from 'react-hook-form';

import AddressComponent from '@/components/Address';
import type { BankType, ProfileType } from '@/types';

export default function BanksForm() {
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
    control,
    formState: { errors },
    setValue,
    handleSubmit,
  } = formMethods;

  const submitHandler = async (formData: BankType) => {
    // try {
    //   const result: { ok: boolean } & Notify = await postData(
    //     `${publicRuntimeConfig.NEXT_PUBLIC_API_URL}/api/restaurant`,
    //     {
    //       restaurantName: formData.restaurantName,
    //       cuisine: formData.cuisine,
    //       address: formData.address,
    //     }
    //   );
    //   if (!result.ok) toast.error(result.error);
    //   toast.success(result.success || 'Restaurant created!');
    //   router.replace('/settings/restaurants');
    // } catch (e) {
    //   toast.error(e.error);
    // }
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

            <AddressComponent<BankType>
              basePropertyName='address'
              addressFields={{
                addressLineName: 'address.addressLine',
                postcodeName: 'address.postcode',
                stateName: 'address.state',
                street_addressName: 'address.street_address',
                suburbName: 'address.suburb',
                addressLineError: errors.address?.addressLine,
                postcodeError: errors.address?.postcode,
                stateError: errors.address?.state,
                street_addressError: errors.address?.street_address,
                suburbError: errors.address?.suburb
              }}
              
            />

            <div>
              <button
                type='submit'
                className='w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500'
              >
                Create
              </button>
            </div>
          </form>
        </FormProvider>
      </div>
    </>
  );
}
