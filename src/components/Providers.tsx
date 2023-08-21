'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { ToastContainer } from 'react-toastify';

import { clientOptions, trpcClient } from '@/server/trpc/client';

const Providers = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = useState(() => new QueryClient());
  const [client] = useState(() => trpcClient.createClient(clientOptions));

  return (
    <trpcClient.Provider client={client} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          {children}
          <ToastContainer />
        </SessionProvider>
      </QueryClientProvider>
    </trpcClient.Provider>
  );
};

export default Providers;
