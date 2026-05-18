import { router } from '@/server/trpc/trpc';
import { authRouter } from './auth';
import { bankRouter } from './bank';
import { businessRouter } from './business';
import { bankInterestRouter } from './bank-interest';
import { individualRouter } from './individual';
import { bankAssetRouter } from './bank-asset';
import { stockAssetRouter } from './stock-asset';
import { aiUsageRouter } from './ai-usage';
import { assetDashboardRouter } from './asset-dashboard';
import { exampleRouter } from './example';
import { transactionLedgerRouter } from './transaction-ledger';
import { userProfileRouter } from './user-profile';
import { transactionClearingRouter } from './transaction-clearing';
import { transferRouter } from './transfer';
import { transferRuleRouter } from './transfer-rule';
import { calendarYearRouter } from './calendar-year';
import { incomeSourceRouter } from './income-source';
import { expenseCategoryRouter } from './expense-category';
import { specialCategoryRouter } from './special-category';
import { bankAccountRouter } from './bank-account';

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
  userProfile: userProfileRouter,
  transactionClearing: transactionClearingRouter,
  transfer: transferRouter,
  transferRule: transferRuleRouter,
  assetDashboard: assetDashboardRouter,
  calendarYear: calendarYearRouter,
  incomeSource: incomeSourceRouter,
  expenseCategory: expenseCategoryRouter,
  specialCategory: specialCategoryRouter,
  bankAccount: bankAccountRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
