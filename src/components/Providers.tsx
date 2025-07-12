'use client';

import React, { useState } from 'react';
import { Flowbite } from 'flowbite-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { ToastContainer } from 'react-toastify';

import { clientOptions, trpc } from '@/server/trpc/client';
import { flowbiteTheme as theme } from '@/styles/theme';

const Providers = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: (failureCount, error) => {
              if (failureCount < 3) return true;
              return false;
            },
          },
        },
      })
  );
  const [trpcClient] = useState(() => trpc.createClient(clientOptions));

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <Flowbite theme={{ theme }}>{children}</Flowbite>
          <ToastContainer />
        </SessionProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
};

export default Providers;
