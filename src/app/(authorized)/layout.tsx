import * as React from 'react';
import { getServerSession } from 'next-auth';

import PageLoading from '@/components/PageLoading';
import Header from '@/components/Header';
import { authOptions } from '@/utils/authOptions';
import { redirect } from 'next/navigation';

export default async function AuthorizedLayout({
  children,
}: {
  children: React.ReactElement;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/login");
  }

  const isUser = !!session?.user;
  if (!isUser) return <PageLoading />; // shouldn't happen

  // Put Header or Footer Here
  const childrenWithUserProp = React.cloneElement(children, {
    user: session.user,
  });
  return (
    <div className='box-border'>
      <Header user={session.user}></Header>

      <div className='flex flex-col'>
        {/* <Navbar logo='/images/logo.png' /> */}
        {childrenWithUserProp}
      </div>
    </div>
  );
}
