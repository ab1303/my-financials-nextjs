# Import Session Date Range — LLD

## Implementation Phases

### Phase 1 — Schema
- Add nullable columns to `ImportSession`:
  - `startDate DateTime?`
  - `endDate DateTime?`
- Generate migration; no backfill required.

### Phase 2 — Confirm Route Persistence
- In CSV confirm route (and AI confirm route where applicable):
  - aggregate `Transaction` min/max date by `importSessionId`,
  - include `startDate`/`endDate` in final `importSession.update(...)`.

### Phase 3 — API Exposure + UI
- Extend `listImportSessions` response with ISO `startDate`/`endDate` nullable fields.
- Update history table to show a `Coverage` column:
  - `—` if null,
  - single date if equal,
  - range format if different.

## Prisma Pattern

```ts
const dateRange = await prisma.transaction.aggregate({
  where: { importSessionId: fileId },
  _min: { date: true },
  _max: { date: true },
});
```

Then persist `startDate: dateRange._min.date ?? null`, `endDate: dateRange._max.date ?? null`.

## Acceptance Criteria

- New imports show coverage range in import history.
- Sessions without transactions show `—`.
- Same-day imports display one date, not a range.
- API contract remains backward-compatible with nullable additions.

## File Inventory

| File | Action | Notes |
|---|---|---|
| `prisma/schema.prisma` | MODIFY | add `startDate`/`endDate` |
| `prisma/migrations/*_add_import_session_date_range/migration.sql` | CREATE | schema migration |
| `src/app/api/transactions/csv/confirm/route.ts` | MODIFY | aggregate + update date range |
| `src/app/api/transactions/ai/confirm/route.ts` | MODIFY | same pattern when applicable |
| `src/server/trpc/router/transaction-clearing.ts` | MODIFY | expose new fields |
| `src/components/transactions/ImportSessionHistory.tsx` | MODIFY | render coverage column |
