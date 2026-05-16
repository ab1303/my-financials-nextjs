'use client';

import { useSession } from 'next-auth/react';
import { trpc } from '@/server/trpc/client';
import { AvatarUpload } from './AvatarUpload';
import { ChangePasswordForm } from './ChangePasswordForm';
import { ProfileForm } from './ProfileForm';
import { ProfileSection } from './ProfileSection';

function ProfileSkeleton() {
  return (
    <div className='animate-pulse space-y-6'>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className='rounded-xl border border-border bg-card p-6 shadow dark:border-gray-700 dark:bg-gray-800'
        >
          <div className='mb-4 h-5 w-32 rounded bg-gray-200 dark:bg-gray-700' />
          <div className='space-y-3'>
            <div className='h-4 w-full rounded bg-gray-100 dark:bg-gray-700' />
            <div className='h-4 w-3/4 rounded bg-gray-100 dark:bg-gray-700' />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProfileClient() {
  const { update: updateSession } = useSession();
  const utils = trpc.useUtils();
  const { data: profile, isLoading, error } = trpc.userProfile.getProfile.useQuery();

  const handleProfileUpdated = async () => {
    await utils.userProfile.getProfile.invalidate();
    await updateSession();
  };

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (error || !profile) {
    return (
      <div className='rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20'>
        <p className='text-sm text-red-600 dark:text-red-400'>
          Failed to load profile. Please refresh the page.
        </p>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <ProfileSection title='Avatar' description='Your profile photo'>
        <AvatarUpload profile={profile} onAvatarChanged={handleProfileUpdated} />
      </ProfileSection>

      <ProfileSection
        title='Personal Information'
        description='Update your personal details and financial preferences'
      >
        <ProfileForm profile={profile} onProfileUpdated={handleProfileUpdated} />
      </ProfileSection>

      {profile.isCredentialsUser && (
        <ProfileSection title='Security' description='Change your password'>
          <ChangePasswordForm />
        </ProfileSection>
      )}
    </div>
  );
}
