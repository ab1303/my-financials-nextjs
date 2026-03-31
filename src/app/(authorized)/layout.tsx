import * as React from 'react';
import { redirect } from 'next/navigation';

import { auth } from '@/server/auth';
import PageLoading from '@/components/PageLoading';
import AppShell from '@/components/AppShell';
import { UserProvider } from './UserProvider';

export default async function AuthorizedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect('/auth/login');
  }

  const isUser = !!session?.user;
  if (!isUser) return <PageLoading />; // shouldn't happen

  return (
    <AppShell user={session.user}>
      <UserProvider user={session.user}>{children}</UserProvider>
    </AppShell>
  );
}
