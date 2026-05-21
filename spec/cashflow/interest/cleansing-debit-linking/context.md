# Cleansing Donations — DEBIT Transaction Linking (Feature Context)

## Problem Summary
The current Interest Cleansing workflow does not allow users to link DEBIT transactions (charity payments) as evidence for cleansing donations. Only CREDIT transactions (interest received) are supported, resulting in incomplete donation records and audit trails.

## Domain Dependencies
- [Cashflow Domain HLD](../hld.md)
- [Interest Cleansing Spec](../interest-cleansing/context.md)

## IN Scope
- Linking DEBIT "Bank Interest" transactions as evidence for cleansing donations
- Fetching only CONFIRMED, unlinked DEBIT transactions with category "Bank Interest"
- Updating CleanseDonationDrawer to show/link DEBIT transactions
- Ensuring DonationPayment references DEBIT transactionId

## OUT of Scope
- Schema/model changes (none required)
- Manual entry flow (already supported)
- Linking non-interest DEBITs or multiple transactions

## Schema References
- See [cashflow hld.md](../hld.md) for full models
- Transaction: `type: 'DEBIT'`, `category: 'Bank Interest'`, `status: 'CONFIRMED'`, `donationPayment: DonationPayment?`
- DonationPayment: `donationPurpose: 'INTEREST_CLEANSING'`, `transactionId: String?`

## Patterns to Reuse
- Use existing DonationPayment model and linkage pattern
- UI/UX patterns from current CleanseDonationDrawer

## Constraints & Gotchas
- Only DEBITs with category "Bank Interest" and status CONFIRMED are eligible
- No schema changes allowed
- Must not break CREDIT transaction logic
- Drawer must show correct date/amount from DEBIT, not CREDIT
