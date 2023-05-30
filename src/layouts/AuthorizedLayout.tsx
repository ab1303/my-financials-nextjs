import { useSession } from 'next-auth/react';
import * as React from 'react';

import PageLoading from '@/components/PageLoading';
import Header from '../components/Header';

export default function AuthorizedLayout({
  children,
}: {
  children: React.ReactElement;
}) {
  const { data: session, status } = useSession({ required: true });

  const isUser = !!session?.user;
  if (status === 'loading' || !isUser) return <PageLoading />;

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
