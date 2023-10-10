import { router } from '@/server/trpc/trpc';
import { authRouter } from './auth';
import { bankRouter } from './bank';
import { bankInterestRouter } from './bank-interest';
import { exampleRouter } from './example';

export const appRouter = router({
  example: exampleRouter,
  auth: authRouter,
  bank: bankRouter,
  bankInterest: bankInterestRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
