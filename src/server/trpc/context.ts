import { type inferAsyncReturnType } from '@trpc/server';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import type { Session } from 'next-auth';

import { auth } from '@/server/auth';
import { prisma } from '../db/client';

type CreateContextOptions = {
  session: Session | null;
  headers?: { [k: string]: string };
};

/** Use this helper for:
 * - testing, so we dont have to mock Next.js' req/res
 * - trpc's `createSSGHelpers` where we don't have req/res
 * @see https://beta.create.t3.gg/en/usage/trpc#-servertrpccontextts
 **/
export const createContextInner = async (opts: CreateContextOptions) => {
  return {
    session: opts.session,
    prisma,
  };
};

/**
 * This is the actual context you'll use in your router
 * @link https://trpc.io/docs/context
 * @link https://github.com/trpc/trpc/blob/main/examples/.experimental/next-app-dir/src/server/context.ts
 **/
export const createContext = async (opts?: FetchCreateContextFnOptions) => {
  const session = await auth();

  return await createContextInner({
    session,
    headers: opts && Object.fromEntries(opts.req.headers),
  });
};

// export const createServerContext = async () => {

//   // Get the session from the server using the unstable_getServerSession wrapper function

//   return await createContextInner({
//     session : null,
//   });
// };

export type Context = inferAsyncReturnType<typeof createContext>;
