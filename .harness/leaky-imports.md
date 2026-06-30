# Leaky import report

## ai-features.ai-image-import

### Internal leak
- src/server/services/ai-import/validation.ts <- @/server/services/ai-import/validation

## architecture.category-filters

### Internal leak
- src/components/transactions/CategoryFilteredLedger.tsx <- @/components/transactions/CategoryFilteredLedger

## assets.bank-assets

### Internal leak
- src/app/(authorized)/cashflow/transactions/_components/ai/_types.ts <- ../../../cashflow/transactions/_components/ai/_types
- src/app/(authorized)/cashflow/transactions/_components/ai/ResultsStep.tsx <- ../../../cashflow/transactions/_components/ai/ResultsStep
- src/app/(authorized)/cashflow/transactions/_components/ai/UploadStep.tsx <- ../../../cashflow/transactions/_components/ai/UploadStep
- src/components/ui/button.tsx <- @/components/ui/button
- src/components/ui/Modal.tsx <- @/components/ui/Modal

## assets.net-worth-dashboard

### Internal leak
- src/app/(authorized)/settings/calendar/_types.ts <- @/app/(authorized)/settings/calendar/_types
- src/app/api/dashboard/summary/route.ts <- @/app/api/dashboard/summary/route

## assets.snapshot-entry-redesign

### Internal leak
- src/components/ui/Modal.tsx <- @/components/ui/Modal

## assets.stock-market-segregation

### Internal leak
- src/app/(authorized)/assets/stocks/NewSnapshotModal.tsx <- ./NewSnapshotModal
- src/app/(authorized)/assets/stocks/SummaryCards.tsx <- ./SummaryCards

## assets.stocks-tracking

### Internal leak
- src/app/(authorized)/assets/stocks/StockAssetsClient.tsx <- ./StockAssetsClient

## assets.zakat-stock-classification

### Internal leak
- src/app/(authorized)/zakat/_schema.ts <- ./_schema

## cashflow.analytics-dashboard

### Public
- src/components/CalendarYearPicker/index.tsx <- @/components/CalendarYearPicker

### Internal leak
- src/app/(authorized)/cashflow/analytics/_components/AnalyticsDrillDownDrawer.tsx <- ./AnalyticsDrillDownDrawer
- src/components/ui/CategoryGroupRollupPanel.tsx <- @/components/ui/CategoryGroupRollupPanel

## cashflow.categories.category-management

### Internal leak
- src/app/(authorized)/settings/categories/_components/CategoriesClient.tsx <- @/app/(authorized)/settings/categories/_components/CategoriesClient

## cashflow.categories.group-rollup

### Internal leak
- src/app/(authorized)/cashflow/expense/actions.ts <- ../actions

## cashflow.donations.donations

### Public
- src/components/CalendarYearPicker/index.tsx <- @/components/CalendarYearPicker

### Internal leak
- src/app/(authorized)/cashflow/donations/_components/LinkTransactionsDrawer.tsx <- ./LinkTransactionsDrawer

## cashflow.donations.transaction-linking

### Internal leak
- src/app/(authorized)/cashflow/donations/_components/CreateBeneficiaryModal.tsx <- ./CreateBeneficiaryModal
- src/app/(authorized)/cashflow/donations/actions.ts <- ../actions

## cashflow.expense.expense-tracking

### Internal leak
- src/app/(authorized)/cashflow/expense/ExpenseTableClient.tsx <- ./ExpenseTableClient

## cashflow.income.income-source-of-truth

### Internal leak
- src/app/(authorized)/cashflow/income/_components/SourceBreakdownWidget.tsx <- ./_components/SourceBreakdownWidget
- src/components/ui/button.tsx <- @/components/ui/button
- src/server/services/transactions/constants.ts <- ./transactions/constants

## cashflow.income.income-ux-improvements

### Internal leak
- src/app/(authorized)/cashflow/income/_types.ts <- ../_types
- src/app/(authorized)/cashflow/income/IncomeTableClient.tsx <- @/app/(authorized)/cashflow/income/IncomeTableClient

## cashflow.interest

### Public
- src/components/CalendarYearPicker/index.tsx <- @/components/CalendarYearPicker

## cashflow.interest.cleansing-debit-linking

### Internal leak
- src/app/(authorized)/cashflow/donations/actions.ts <- @/app/(authorized)/cashflow/donations/actions
- src/components/ui/button.tsx <- @/components/ui/button

## cashflow.multi-account-transfer-integrity

### Internal leak
- src/server/services/transactions/constants.ts <- @/server/services/transactions/constants

## cashflow.multi-account-transfer-integrity.fix-transfer-exclusion

### Internal leak
- src/server/services/ai-import/_types.ts <- @/server/services/ai-import/_types
- src/server/services/transactions/_types.ts <- ./_types
- src/server/services/transactions/constants.ts <- @/server/services/transactions/constants

## cashflow.multi-account-transfer-integrity.handle-orphans

### Internal leak
- src/app/(authorized)/cashflow/expense/ExpenseTableServer.tsx <- ./ExpenseTableServer
- src/app/(authorized)/cashflow/income/IncomeTableServer.tsx <- ./IncomeTableServer

## cashflow.multi-account-transfer-integrity.harden-import-wizard

### Internal leak
- src/app/(authorized)/cashflow/transactions/_components/csv/CSVUploadStep.tsx <- ./CSVUploadStep
- src/app/(authorized)/cashflow/transactions/_components/csv/DuplicatesTab.tsx <- ./DuplicatesTab
- src/app/(authorized)/cashflow/transactions/_components/transfer/PostImportMatchBanner.tsx <- ../transfer/PostImportMatchBanner
- src/components/csv-import/TransactionReviewTable.tsx <- @/components/csv-import/TransactionReviewTable
- src/components/ui/button.tsx <- @/components/ui/button
- src/server/services/ai-import/_types.ts <- @/server/services/ai-import/_types

## cashflow.multi-account-transfer-integrity.improve-detection

### Internal leak
- src/server/services/transactions/_types.ts <- ./_types
- src/server/services/transactions/constants.ts <- ./constants

## cashflow.transfer-resolution-improvements

### Internal leak
- src/app/(authorized)/cashflow/transactions/_components/transfer/TransferLinkDrawer.tsx <- ./TransferLinkDrawer

## cashflow.zakat

### Internal leak
- src/app/(authorized)/zakat/_types.ts <- ./_types
- src/app/(authorized)/zakat/form.tsx <- ./form

## csv-import.generic-csv-import

### Internal leak
- src/server/services/ai-import/_types.ts <- ./_types
- src/server/services/ai-import/validation.ts <- @/server/services/ai-import/validation

## csv-import.llm-classification

### Internal leak
- src/server/services/ai-import/_types.ts <- ./_types

## csv-import.semantic-matching

### Internal leak
- src/server/services/ai-import/_types.ts <- ./_types

## home.dashboard

### Internal leak
- src/components/ui/button.tsx <- @/components/ui/button
- src/components/ui/card.tsx <- @/components/ui/card
- src/server/services/transactions/constants.ts <- ./transactions/constants

## phase2-scope.home-dashboard-widgets

### Internal leak
- src/components/ui/button.tsx <- @/components/ui/button
- src/components/ui/card.tsx <- @/components/ui/card

## reports.income-summary

### Internal leak
- src/app/(authorized)/cashflow/income/_types.ts <- @/app/(authorized)/cashflow/income/_types

## settings.calendar-management

### Internal leak
- src/components/ui/TextInput.tsx <- @/components/ui/TextInput

## settings.category-management

### Internal leak
- src/app/(authorized)/settings/categories/_components/ExpenseCategories.tsx <- ./ExpenseCategories
- src/app/(authorized)/settings/categories/_components/IncomeSources.tsx <- ./IncomeSources

## technical_debt.preapply-category-rules

### Internal leak
- src/server/services/ai-import/_types.ts <- @/server/services/ai-import/_types
- src/server/services/ai-import/validation.ts <- @/server/services/ai-import/validation
- src/server/services/transactions/bank-format-registry.ts <- @/server/services/transactions/bank-format-registry

## technical_debt.remove-denormalized-monthly-expense-summary

### Internal leak
- src/server/services/transactions/constants.ts <- ./transactions/constants

## transactions.import-audit-trail

### Internal leak
- src/components/transactions/VoidedTransactionsModal.tsx <- @/components/transactions/VoidedTransactionsModal
- src/components/ui/Modal.tsx <- @/components/ui/Modal

## transactions.paginated-search

### Public
- src/server/trpc/router/transaction-ledger/index.ts <- @/server/trpc/router/transaction-ledger

### Internal leak
- src/components/transactions/TransactionRow.tsx <- @/components/transactions/TransactionRow

## transactions.reimbursements

### Public
- src/server/trpc/router/transaction-ledger/index.ts <- @/server/trpc/router/transaction-ledger

## transactions.transaction-bulk-apply

### Public
- src/server/trpc/router/transaction-ledger/index.ts <- @/server/trpc/router/transaction-ledger

### Internal leak
- src/components/transactions/CategoryRuleDrawer.tsx <- ./CategoryRuleDrawer
- src/components/transactions/PreviewMatchesModal.tsx <- ./PreviewMatchesModal
- src/components/transactions/ReimbursementSubRow.tsx <- ./ReimbursementSubRow
- src/components/transactions/RestoreTransactionButton.tsx <- ./RestoreTransactionButton
- src/components/transactions/TransactionSourceIndicator.tsx <- ./TransactionSourceIndicator
- src/components/transactions/UnlinkTransferButton.tsx <- ./UnlinkTransferButton
- src/components/transactions/VoidTransactionButton.tsx <- ./VoidTransactionButton
- src/server/services/transactions/constants.ts <- @/server/services/transactions/constants

## transactions.transaction-ledger

### Internal leak
- src/app/(authorized)/cashflow/donations/_components/LinkTransactionsDrawer.tsx <- @/app/(authorized)/cashflow/donations/_components/LinkTransactionsDrawer
- src/app/(authorized)/cashflow/transactions/_components/transfer/OrphanResolutionPanel.tsx <- @/app/(authorized)/cashflow/transactions/_components/transfer/OrphanResolutionPanel
- src/app/(authorized)/cashflow/transactions/_components/transfer/SmartMatchDialog.tsx <- @/app/(authorized)/cashflow/transactions/_components/transfer/SmartMatchDialog
- src/app/(authorized)/cashflow/transactions/_components/transfer/TransferLinkDrawer.tsx <- @/app/(authorized)/cashflow/transactions/_components/transfer/TransferLinkDrawer
- src/app/(authorized)/cashflow/transactions/_components/transfer/UnmatchedTransfersBadge.tsx <- @/app/(authorized)/cashflow/transactions/_components/transfer/UnmatchedTransfersBadge
- src/app/(authorized)/zakat/_components/LinkZakatTransactionsDrawer.tsx <- @/app/(authorized)/zakat/_components/LinkZakatTransactionsDrawer
- src/components/transactions/TransactionFilters.tsx <- ./TransactionFilters
- src/components/transactions/TransactionRow.tsx <- ./TransactionRow
- src/components/transactions/TransactionSummary.tsx <- ./TransactionSummary
- src/server/services/transactions/constants.ts <- @/server/services/transactions/constants

## transactions.transactions

### Public
- src/server/trpc/router/transaction-ledger/index.ts <- @/server/trpc/router/transaction-ledger

### Internal leak
- src/app/(authorized)/cashflow/transactions/_components/csv/_types.ts <- ./_types
- src/app/(authorized)/cashflow/transactions/_components/csv/CSVImportWizard.tsx <- ./csv/CSVImportWizard
- src/components/csv-import/TransactionReviewTable.tsx <- @/components/csv-import/TransactionReviewTable
- src/components/transactions/CategoryFilteredLedger.tsx <- @/components/transactions/CategoryFilteredLedger
- src/components/transactions/ImportSessionHistory.tsx <- @/components/transactions/ImportSessionHistory
- src/components/transactions/TransactionLedgerTable.tsx <- @/components/transactions/TransactionLedgerTable
- src/components/transactions/TransactionRow.tsx <- @/components/transactions/TransactionRow
- src/components/ui/button.tsx <- @/components/ui/button
- src/components/ui/Modal.tsx <- @/components/ui/Modal
- src/server/services/ai-import/_types.ts <- @/server/services/ai-import/_types
- src/server/services/transactions/constants.ts <- @/server/services/transactions/constants

## transactions.transfer-match-rules

### Internal leak
- src/server/services/transactions/constants.ts <- ./constants

## user-profile.user-profile

### Internal leak
- src/app/(authorized)/settings/profile/_schema.ts <- @/app/(authorized)/settings/profile/_schema
- src/app/(authorized)/settings/profile/_types.ts <- @/app/(authorized)/settings/profile/_types
