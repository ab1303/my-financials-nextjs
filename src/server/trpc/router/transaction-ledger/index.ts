import { router } from '@/server/trpc/trpc';

import { restoreVoidedTransactionMutation } from './mutations/restoreVoidedTransaction';
import { updateCategoryMutation } from './mutations/updateCategory';
import { getAllQuery } from './queries/getAll';
import { getFilterOptionsQuery } from './queries/getFilterOptions';
import { getUnlinkedDonationTransactionsQuery } from './queries/getUnlinkedDonationTransactions';
import { getUnlinkedZakatTransactionsQuery } from './queries/getUnlinkedZakatTransactions';
import { getVoidedTransactionsQuery } from './queries/getVoidedTransactions';
import { previewMatchingCategoryChangesQuery } from './queries/previewMatchingCategoryChanges';
import { searchDebitTransactionsQuery } from './queries/searchDebitTransactions';

export * from './shared';

export const transactionLedgerRouter = router({
  getAll: getAllQuery,
  getFilterOptions: getFilterOptionsQuery,
  searchDebitTransactions: searchDebitTransactionsQuery,
  getUnlinkedDonationTransactions: getUnlinkedDonationTransactionsQuery,
  getUnlinkedZakatTransactions: getUnlinkedZakatTransactionsQuery,
  getVoidedTransactions: getVoidedTransactionsQuery,
  previewMatchingCategoryChanges: previewMatchingCategoryChangesQuery,
  updateCategory: updateCategoryMutation,
  restoreVoidedTransaction: restoreVoidedTransactionMutation,
});
