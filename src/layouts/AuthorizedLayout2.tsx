import { useSession } from 'next-auth/react';
import * as React from 'react';

import PageLoading from '@/components/PageLoading';
import Header from './Header';

export default function AuthorizedLayout2({
  children,
}: {
  children: React.ReactElement;
}) {
  const { data: session, status } = useSession();

  if (status === 'loading') return <PageLoading />;

  if (status === 'unauthenticated' || !session) return children;

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
