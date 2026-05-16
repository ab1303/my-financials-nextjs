'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { trpc } from '@/server/trpc/client';
import {
  type UpdateProfileFormValues,
  updateProfileSchema,
} from '../_schema';
import type { UserProfileData } from '../_types';

interface ProfileFormProps {
  profile: UserProfileData;
  onProfileUpdated: () => void;
}

const TIMEZONE_OPTIONS =
  typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl
    ? (
        Intl as unknown as { supportedValuesOf: (key: string) => string[] }
      ).supportedValuesOf('timeZone')
    : ['Australia/Sydney', 'America/New_York', 'Europe/London', 'Asia/Tokyo'];

const CURRENCY_OPTIONS = [
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'USD', label: 'USD — US Dollar' },
] as const;

const FISCAL_YEAR_OPTIONS = [
  { value: 'FISCAL', label: 'Jul – Jun (Australian Financial Year)' },
  { value: 'ANNUAL', label: 'Jan – Dec (Calendar Year)' },
] as const;

export function ProfileForm({ profile, onProfileUpdated }: ProfileFormProps) {
  const { update: updateSession } = useSession();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateProfileFormValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: profile.name ?? '',
      phone: profile.phone ?? '',
      bio: profile.bio ?? '',
      timezone: profile.timezone ?? 'Australia/Sydney',
      linkedInUrl: profile.linkedInUrl ?? '',
      preferredCurrency: (profile.preferredCurrency as 'AUD' | 'USD') ?? 'AUD',
      fiscalYearType:
        (profile.fiscalYearType as 'FISCAL' | 'ANNUAL') ?? 'FISCAL',
    },
  });

  useEffect(() => {
    reset({
      name: profile.name ?? '',
      phone: profile.phone ?? '',
      bio: profile.bio ?? '',
      timezone: profile.timezone ?? 'Australia/Sydney',
      linkedInUrl: profile.linkedInUrl ?? '',
      preferredCurrency: (profile.preferredCurrency as 'AUD' | 'USD') ?? 'AUD',
      fiscalYearType:
        (profile.fiscalYearType as 'FISCAL' | 'ANNUAL') ?? 'FISCAL',
    });
  }, [profile, reset]);

  const updateMutation = trpc.userProfile.updateProfile.useMutation({
    onSuccess: async () => {
      toast.success('Profile updated successfully');
      await updateSession();
      onProfileUpdated();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (data: UpdateProfileFormValues) => {
    updateMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='space-y-6'>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        <div>
          <label
            htmlFor='name'
            className='mb-1 block cursor-pointer text-sm font-medium text-foreground dark:text-white'
          >
            Full Name <span className='text-red-500'>*</span>
          </label>
          <input
            id='name'
            type='text'
            {...register('name')}
            className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400'
          />
          {errors.name && (
            <p className='mt-1 text-xs text-red-500'>{errors.name.message}</p>
          )}
        </div>

        <div>
          <label
            htmlFor='phone'
            className='mb-1 block cursor-pointer text-sm font-medium text-foreground dark:text-white'
          >
            Phone
          </label>
          <input
            id='phone'
            type='tel'
            {...register('phone')}
            placeholder='+61 4xx xxx xxx'
            className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400'
          />
          {errors.phone && (
            <p className='mt-1 text-xs text-red-500'>{errors.phone.message}</p>
          )}
        </div>
      </div>

      <div>
        <label
          htmlFor='email'
          className='mb-1 block cursor-default text-sm font-medium text-muted-foreground dark:text-gray-400'
        >
          Email Address (read-only)
        </label>
        <input
          id='email'
          type='email'
          value={profile.email ?? ''}
          disabled
          className='w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-400'
        />
      </div>

      <div>
        <label
          htmlFor='bio'
          className='mb-1 block cursor-pointer text-sm font-medium text-foreground dark:text-white'
        >
          Bio
        </label>
        <textarea
          id='bio'
          {...register('bio')}
          rows={3}
          placeholder='A short note about yourself...'
          className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400'
        />
        {errors.bio && (
          <p className='mt-1 text-xs text-red-500'>{errors.bio.message}</p>
        )}
      </div>

      <div>
        <label
          htmlFor='linkedInUrl'
          className='mb-1 block cursor-pointer text-sm font-medium text-foreground dark:text-white'
        >
          LinkedIn Profile URL
        </label>
        <input
          id='linkedInUrl'
          type='url'
          {...register('linkedInUrl')}
          placeholder='https://linkedin.com/in/your-profile'
          className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400'
        />
        {errors.linkedInUrl && (
          <p className='mt-1 text-xs text-red-500'>
            {errors.linkedInUrl.message}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor='timezone'
          className='mb-1 block cursor-pointer text-sm font-medium text-foreground dark:text-white'
        >
          Timezone <span className='text-red-500'>*</span>
        </label>
        <select
          id='timezone'
          {...register('timezone')}
          className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white'
        >
          {TIMEZONE_OPTIONS.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
        {errors.timezone && (
          <p className='mt-1 text-xs text-red-500'>{errors.timezone.message}</p>
        )}
      </div>

      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        <div>
          <p className='mb-2 text-sm font-medium text-foreground dark:text-white'>
            Preferred Currency
          </p>
          <div className='space-y-2'>
            {CURRENCY_OPTIONS.map(({ value, label }) => (
              <label
                key={value}
                className='flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300'
              >
                <input
                  type='radio'
                  value={value}
                  {...register('preferredCurrency')}
                  className='accent-teal-500'
                />
                {label}
              </label>
            ))}
          </div>
          {errors.preferredCurrency && (
            <p className='mt-1 text-xs text-red-500'>
              {errors.preferredCurrency.message}
            </p>
          )}
        </div>

        <div>
          <p className='mb-2 text-sm font-medium text-foreground dark:text-white'>
            Financial Year
          </p>
          <div className='space-y-2'>
            {FISCAL_YEAR_OPTIONS.map(({ value, label }) => (
              <label
                key={value}
                className='flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300'
              >
                <input
                  type='radio'
                  value={value}
                  {...register('fiscalYearType')}
                  className='accent-teal-500'
                />
                {label}
              </label>
            ))}
          </div>
          {errors.fiscalYearType && (
            <p className='mt-1 text-xs text-red-500'>
              {errors.fiscalYearType.message}
            </p>
          )}
        </div>
      </div>

      <div className='flex justify-end'>
        <button
          type='submit'
          disabled={!isDirty || isSubmitting || updateMutation.isPending}
          className='rounded-lg bg-teal-600 px-6 py-2 text-sm font-medium text-white hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-teal-500 dark:hover:bg-teal-600'
        >
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
