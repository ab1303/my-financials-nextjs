import { ProfileClient } from './_components/ProfileClient';

export const metadata = {
  title: 'Profile — My Financials',
  description: 'Manage your account settings and preferences',
};

export default function ProfilePage() {
  return (
    <main className='px-4 py-6 sm:px-6 lg:px-8'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold tracking-tight text-foreground dark:text-white'>
          Profile
        </h1>
        <p className='mt-1 text-sm text-muted-foreground dark:text-gray-400'>
          Manage your account settings and preferences
        </p>
      </div>
      <ProfileClient />
    </main>
  );
}
