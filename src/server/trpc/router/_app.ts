import { router } from '@/server/trpc/trpc';

import { aiUsageRouter } from './ai-usage';
import { assetDashboardRouter } from './asset-dashboard';
import { authRouter } from './auth';
import { bankRouter } from './bank';
import { bankAccountRouter } from './bank-account';
import { bankAssetRouter } from './bank-asset';
import { bankInterestRouter } from './bank-interest';
import { brokerageRouter } from './brokerage';
import { businessRouter } from './business';
import { calendarYearRouter } from './calendar-year';
import { categoryRuleRouter } from './category-rule';
import { categoryTransactionsRouter } from './category-transactions';
import { exampleRouter } from './example';
import { expenseCategoryRouter } from './expense-category';
import { incomeSourceRouter } from './income-source';
import { individualRouter } from './individual';
import { specialCategoryRouter } from './special-category';
import { stockAssetRouter } from './stock-asset';
import { transactionClearingRouter } from './transaction-clearing';
import { transactionLedgerRouter } from './transaction-ledger';
import { transferRouter } from './transfer';
import { transferRuleRouter } from './transfer-rule';
import { userProfileRouter } from './user-profile';

export const appRouter = router({
  example: exampleRouter,
  auth: authRouter,
  bank: bankRouter,
  brokerage: brokerageRouter,
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
  categoryRule: categoryRuleRouter,
  assetDashboard: assetDashboardRouter,
  calendarYear: calendarYearRouter,
  incomeSource: incomeSourceRouter,
  expenseCategory: expenseCategoryRouter,
  specialCategory: specialCategoryRouter,
  bankAccount: bankAccountRouter,
  categoryTransactions: categoryTransactionsRouter,
});


// export type definition of API
export type AppRouter = typeof appRouter;
