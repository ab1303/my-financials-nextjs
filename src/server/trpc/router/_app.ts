import { router } from '@/server/trpc/trpc';
import { authRouter } from './auth';
import { bankRouter } from './bank';
import { businessRouter } from './business';
import { bankInterestRouter } from './bank-interest';
import { individualRouter } from './individual';
import { bankAssetRouter } from './bank-asset';
import { stockAssetRouter } from './stock-asset';
import { aiUsageRouter } from './ai-usage';
import { exampleRouter } from './example';
import { transactionLedgerRouter } from './transaction-ledger';

export const appRouter = router({
  example: exampleRouter,
  auth: authRouter,
  bank: bankRouter,
  bankInterest: bankInterestRouter,
  individual: individualRouter,
  business: businessRouter,
  bankAsset: bankAssetRouter,
  stockAsset: stockAssetRouter,
  aiUsage: aiUsageRouter,
  transactionLedger: transactionLedgerRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
