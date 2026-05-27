# IncomeRecord

## Status
⚠️ **DEPRECATED** — See migration path below.

## Purpose (Historical)
Previously captured an individual income event with an optional link to a Transaction. This design was abandoned after architectural review against industry standards (Firefly III, Maybe Finance, Actual Budget).

## Deprecation Rationale

The separate `IncomeRecord` table created data duplication and sync complexity:
- `csv-confirm.service.ts` created both `Transaction` and `IncomeRecord` for imports
- `void.service.ts` required separate sync logic (`reverseIncomeRecord`, `reapplyIncomeRecord`)
- `transactionId` FK was often null (orphaned copies) due to sync bugs
- Industry standard: Firefly III, Maybe Finance, Actual Budget all source income directly from the Transaction table

## Migration Path

**Manual income entries** now go directly into the `Transaction` table:
- `type = 'CREDIT'`
- `source = 'MANUAL'`
- `status = 'CONFIRMED'`

**Imported income** remains in `Transaction`:
- `type = 'CREDIT'`
- `source = 'BANK'` or `'LLM_CLASSIFIED'`
- `status = 'CONFIRMED'`

The `getIncomeEntries` service now queries:
```sql
SELECT * FROM Transaction 
WHERE type = 'CREDIT' 
  AND status = 'CONFIRMED' 
  AND date BETWEEN ? AND ?
  AND userId = ?
ORDER BY date DESC
```

**Data migration**: Delete all `IncomeRecord` rows. Manual entries must be re-added as `Transaction` records.

See: [`spec/cashflow/income/income-source-of-truth/`](../../cashflow/income/income-source-of-truth/) for full rationale and implementation.
