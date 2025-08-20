// This is mainly an experimental and I ran into issues using trpc in server
// mainly issues around caching;
// Thus going forward to keep things simple, I decided to not use trpc on server and use server action instead where required.

'use server';

import { loggerLink } from '@trpc/client';
import { experimental_nextHttpLink } from '@trpc/next/app-dir/links/nextHttp';
import { experimental_createTRPCNextAppDirServer } from '@trpc/next/app-dir/server';
import { cookies } from 'next/headers';
import superjson from 'superjson';

import type { AppRouter } from './router/_app';
import { getUrl } from './shared';

export const httpServer = experimental_createTRPCNextAppDirServer<AppRouter>({
  config() {
    return {
      links: [
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === 'development' ||
            (opts.direction === 'down' && opts.result instanceof Error),
        }),
        experimental_nextHttpLink({
          batch: true,
          url: getUrl(),
          transformer: superjson,
          async headers() {
            const cookieStore = await cookies();
            return {
              cookie: cookieStore.toString(),
              'x-trpc-source': 'rsc-http',
            };
          },
        }),
      ],
    };
  },
});
