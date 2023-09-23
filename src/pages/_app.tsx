import { SessionProvider } from 'next-auth/react';
import { ToastContainer } from 'react-toastify';

import Layout from '@/layouts/Layout';

// types
import type { AppLayoutProps } from 'next/app';
import type { ReactNode } from 'react';

// css
import '@/styles/globals.css';
import 'react-toastify/dist/ReactToastify.css';
import 'react-day-picker/dist/style.css';

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

export default MyApp;
