'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'sonner';

import { clientOptions, trpc } from '@/server/trpc/client';

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
      }),
  );
  const [trpcClient] = useState(() => trpc.createClient(clientOptions));

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          {children}
          <Toaster richColors position='top-right' />
        </SessionProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
};

export default Providers;
