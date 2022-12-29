import type { AppLayoutProps } from 'next/app';
import { SessionProvider } from 'next-auth/react';

import type { ReactNode } from 'react';

import { trpc } from '@/utils/trpc';

import '@/styles/globals.css';
import 'react-toastify/dist/ReactToastify.css';
import Layout from '@/layouts/Layout';
import { ToastContainer } from 'react-toastify';

const MyApp = ({
  Component,
  pageProps: { session, ...pageProps },
}: AppLayoutProps) => {
  const getLayout =
    Component.getLayout ?? ((page: ReactNode) => <Layout>{page}</Layout>);

  return (
    <SessionProvider session={session}>
      {getLayout(<Component {...pageProps} />)}
      <ToastContainer />
    </SessionProvider>
  );
};

export default trpc.withTRPC(MyApp);
