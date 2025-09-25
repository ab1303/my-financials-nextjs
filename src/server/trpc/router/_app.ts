import { router } from '@/server/trpc/trpc';
import { authRouter } from './auth';
import { bankRouter } from './bank';
import { businessRouter } from './business';
import { bankInterestRouter } from './bank-interest';
import { individualRouter } from './individual';

import { exampleRouter } from './example';

export const appRouter = router({
  example: exampleRouter,
  auth: authRouter,
  bank: bankRouter,
  bankInterest: bankInterestRouter,
  individual: individualRouter,
  business: businessRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
