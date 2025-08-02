import * as React from 'react';
import { getServerSession } from 'next-auth';

import PageLoading from '@/components/PageLoading';
import Header from '@/components/Header';
import { authOptions } from '@/utils/authOptions';
import { redirect } from 'next/navigation';
import { UserProvider } from './UserProvider';

export default async function AuthorizedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/login");
  }

  const isUser = !!session?.user;
  if (!isUser) return <PageLoading />; // shouldn't happen

 return (
    <div className='box-border'>
      <Header user={session.user} />
      
      <div className='flex flex-col'>
        <UserProvider user={session.user}>
          {children}
        </UserProvider>
      </div>
    </div>
  );
}
