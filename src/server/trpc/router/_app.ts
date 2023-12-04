import { router } from '@/server/trpc/trpc';
import { authRouter } from './auth';
import { bankRouter } from './bank';
import { bankInterestRouter } from './bank-interest';
import { individualRouter } from './individual';

import { exampleRouter } from './example';

export const appRouter = router({
  example: exampleRouter,
  auth: authRouter,
  bank: bankRouter,
  bankInterest: bankInterestRouter,
  individual: individualRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
