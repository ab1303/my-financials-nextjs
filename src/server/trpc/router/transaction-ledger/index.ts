import { router } from '@/server/trpc/trpc';
import { getAllQuery } from './queries/getAll';
import { getFilterOptionsQuery } from './queries/getFilterOptions';
import { searchDebitTransactionsQuery } from './queries/searchDebitTransactions';
import { getUnlinkedDonationTransactionsQuery } from './queries/getUnlinkedDonationTransactions';
import { getUnlinkedZakatTransactionsQuery } from './queries/getUnlinkedZakatTransactions';
import { getVoidedTransactionsQuery } from './queries/getVoidedTransactions';
import { updateCategoryMutation } from './mutations/updateCategory';
import { restoreVoidedTransactionMutation } from './mutations/restoreVoidedTransaction';

export const transactionLedgerRouter = router({
  getAll: getAllQuery,
  getFilterOptions: getFilterOptionsQuery,
  searchDebitTransactions: searchDebitTransactionsQuery,
  getUnlinkedDonationTransactions: getUnlinkedDonationTransactionsQuery,
  getUnlinkedZakatTransactions: getUnlinkedZakatTransactionsQuery,
  getVoidedTransactions: getVoidedTransactionsQuery,
  updateCategory: updateCategoryMutation,
  restoreVoidedTransaction: restoreVoidedTransactionMutation,
});
