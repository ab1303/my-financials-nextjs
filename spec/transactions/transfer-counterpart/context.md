# Transfer Counterpart Display — Context

## Problem

When a transaction is linked as a transfer pair, the row shows a chain-link icon but gives no information about what it is linked to. The user cannot see the counterpart's description, amount, date, or account without manually hunting for it in the ledger.

## Domain Dependencies

- Uses: `Transaction` self-referential `"TransferLink"` relation from domain HLD; both `transferLinkedTransaction` (DEBIT side, FK) and `transferCounterpart` (CREDIT side, back-relation) must be queried — exactly one will be non-null on any linked row
- Patterns: `TransactionRow` component; tRPC `getAll` response shape
- Related features: transfer-reconciliation (must be implemented first — provides the link data); transaction-ledger (modifies the `getAll` query and `TransactionRow`)

## Scope

**In scope:**
- Extend `getAll` query to include counterpart fields (description, date, amount, type, bank account)
- Add `transferCounterpart` shape to `TransactionRow` TypeScript type
- Render a counterpart summary chip inline on linked rows in `TransactionRow`

**Out of scope:**
- New tRPC procedures
- Schema changes
- Migrations
- Click-through navigation to the counterpart row

## Known Constraints

- Must query **both** relations (`transferLinkedTransaction` and `transferCounterpart`) because the DEBIT holds the FK and the CREDIT uses the back-relation; the mapping block must coalesce them
- Backwards compatibility: `transferCounterpartId: string | null` field must be preserved in `TransactionRow` type

## Files

| File | Action | Description |
|---|---|---|
| `src/server/api/routers/transaction-ledger.ts` | MODIFY | Include full counterpart fields in `getAll`; coalesce `transferLinkedTransaction` and `transferCounterpart` in mapping |
| `src/components/transactions/TransactionRow.tsx` | MODIFY | Render counterpart summary chip (description, amount, date, bank) on linked rows |
