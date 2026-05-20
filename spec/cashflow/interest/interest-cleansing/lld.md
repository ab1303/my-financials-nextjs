# Interest Cleansing — Low-Level Design

## Implementation Details

### Ledger-First Interest Model
- Treat confirmed `Transaction` credits categorized as bank interest as the primary source for interest received.
- Keep `BankInterestLiability.amountDue` as a monthly manual override for statement gaps or non-imported interest.
- Reuse `DonationPayment` with `donationPurpose = INTEREST_CLEANSING` instead of maintaining a separate long-term payment model.

### Service and Aggregation Layer
- Provide a bank-interest service that combines bank accounts, calendar-year boundaries, confirmed interest credits, monthly overrides, and interest-cleansing donations.
- Preserve monthly credit visibility for what was received while calculating cleansing totals as a yearly obligation pool.
- Return derived yearly summary data for total received, total cleansed, remaining balance, and any unlinked interest transactions.

### UI Flow
- Keep the page server-first with summary cards for received, cleansed, and remaining totals.
- Show a monthly interest-credits table for ledger-derived and manually overridden amounts.
- Surface unlinked interest work through a banner and a cleansing drawer that supports linked-transaction and manual-entry modes.
- Keep row-level editing limited to manual overrides; donation creation happens through the dedicated cleansing flow.

### Schema and Migration Notes
- Introduce `DonationPurposeEnum` and default ordinary donations to `VOLUNTARY` when the schema has not yet been upgraded.
- Backfill legacy `BankInterestPayment` rows into `DonationPayment(INTEREST_CLEANSING)` where data quality allows.
- Treat legacy month-attribution behavior as superseded by the yearly cleansing-pool model, while preserving monthly receipt reporting.

## File Inventory
- `prisma/schema.prisma` — `DonationPurposeEnum`, donation purpose field, and legacy interest comments.
- `prisma/migrations/<timestamp>_add_donation_purpose_enum/migration.sql` — schema and backfill migration.
- `src/server/services/bank-interest/interest-cleansing.service.ts` — yearly aggregation and derived summary logic.
- `src/server/trpc/router/bank-interest.ts` — protected procedures for cleansing data and unlinked transactions.
- `src/app/(authorized)/cashflow/bank-interest/BankInterestTableServer.tsx` — server data loading and section orchestration.
- `src/app/(authorized)/cashflow/bank-interest/InterestCreditsTable.tsx` — monthly credits view and manual override editing.
- `src/app/(authorized)/cashflow/bank-interest/_components/UnlinkedInterestBanner.tsx` — follow-up banner for uncleansed interest credits.
- `src/app/(authorized)/cashflow/bank-interest/_components/CleanseDonationDrawer.tsx` — linked/manual cleansing entry flow.
- `src/app/(authorized)/cashflow/bank-interest/_components/CleansingDonationsList.tsx` — yearly donation list for cleansing records.
- `src/app/(authorized)/cashflow/bank-interest/_types.ts` — derived yearly data types shared with the client layer.
- `src/app/(authorized)/cashflow/bank-interest/reducer.ts` — client state updates for derived interest data.
- `src/app/(authorized)/cashflow/bank-interest/page.tsx` — summary cards and top-level page composition.
- `src/app/(authorized)/cashflow/donations/actions.ts` — donation creation path reused for cleansing payments.