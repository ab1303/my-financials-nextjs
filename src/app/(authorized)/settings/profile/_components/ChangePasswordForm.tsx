'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { trpc } from '@/server/trpc/client';
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from '../_schema';

export function ChangePasswordForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
  });

  const changeMutation = trpc.userProfile.changePassword.useMutation({
    onSuccess: () => {
      toast.success('Password changed successfully');
      reset();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (data: ChangePasswordFormValues) => {
    changeMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='max-w-md space-y-4'>
      <div>
        <label
          htmlFor='currentPassword'
          className='mb-1 block cursor-pointer text-sm font-medium text-foreground dark:text-white'
        >
          Current Password
        </label>
        <input
          id='currentPassword'
          type='password'
          {...register('currentPassword')}
          autoComplete='current-password'
          className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white'
        />
        {errors.currentPassword && (
          <p className='mt-1 text-xs text-red-500'>
            {errors.currentPassword.message}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor='newPassword'
          className='mb-1 block cursor-pointer text-sm font-medium text-foreground dark:text-white'
        >
          New Password
        </label>
        <input
          id='newPassword'
          type='password'
          {...register('newPassword')}
          autoComplete='new-password'
          className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white'
        />
        <p className='mt-1 text-xs text-muted-foreground dark:text-gray-400'>
          Must be 8+ characters with uppercase, lowercase, and a number
        </p>
        {errors.newPassword && (
          <p className='mt-1 text-xs text-red-500'>{errors.newPassword.message}</p>
        )}
      </div>

      <div>
        <label
          htmlFor='confirmPassword'
          className='mb-1 block cursor-pointer text-sm font-medium text-foreground dark:text-white'
        >
          Confirm New Password
        </label>
        <input
          id='confirmPassword'
          type='password'
          {...register('confirmPassword')}
          autoComplete='new-password'
          className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white'
        />
        {errors.confirmPassword && (
          <p className='mt-1 text-xs text-red-500'>
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      <button
        type='submit'
        disabled={isSubmitting || changeMutation.isPending}
        className='rounded-lg bg-teal-600 px-6 py-2 text-sm font-medium text-white hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-teal-500 dark:hover:bg-teal-600'
      >
        {changeMutation.isPending ? 'Changing...' : 'Change Password'}
      </button>
    </form>
  );
}
