// https://github.com/trpc/trpc/tree/main/examples/next-edge-runtime/src

import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

import { createContext } from '@/server/trpc/context';
import { appRouter } from '@/server/trpc/router/_app';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext,
  });
export { handler as GET, handler as POST };
