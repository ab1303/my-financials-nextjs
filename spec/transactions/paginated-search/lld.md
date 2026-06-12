Low-level design: Cursor-based pagination for `searchDebitTransactions`

## API changes

Replace/extend the existing `searchDebitTransactions` query signature with optional cursor fields and paginated response shape.

Input (zod)

```
{
  search?: string,
  take?: number // 1..200 default 50
  dateFrom?: string,
  dateTo?: string,
  cursor?: { id: string } | undefined
}
```

Output

```
{
  items: Array<{ id, date, description, amount, category, importSource }>,
  nextCursor?: { id: string } | undefined
}
```

## Implementation notes (server)

- Ordering: `{ date: 'desc' }, { id: 'desc' }` to provide deterministic order.
- Use `take = (requestedTake ?? default) + 1` to detect if more records exist.
- If `cursor` is provided: apply a cursor-based filter. Because Prisma's `cursor` API requires a unique field, use the `id` cursor and then apply a compound where clause to only fetch items older than the cursor position:
  - Fetch where `(date < cursorDate) OR (date = cursorDate AND id < cursorId)` given ordering desc. To implement this, first load the cursor row to get its `date`, then include a where clause as above.
- After fetching `take+1` rows, if more than requested, set `nextCursor` to the last returned row's `id` and remove it from `items` before returning.

## Implementation notes (client)

- Keep existing `loadOptions` entrypoint but switch to an incremental loader:
  - Maintain local `options` array and `nextCursor` state.
  - On first load (or when search term changes), reset `options` and `nextCursor` then request first page with `cursor = undefined, take = pageSize`.
  - Hook `onMenuScrollToBottom` (react-select prop) to call the same endpoint with `cursor = nextCursor` and append returned items.
  - Ensure deduplication by `id` while appending.
- Maintain default small page size (e.g. 25) for snappy UI; request larger when user explicitly toggles "Load more".

## Backward compatibility

- Existing clients that continue to call the endpoint with `limit` only will still receive a single-page result (server will treat `cursor` as undefined). Provide a temporary compatibility layer to accept old parameter names (`limit`) and map them to `take`.

## Testing

- Unit tests for server: verify `cursor` logic (cursor at start/middle/end), verify `take+1` behaviour and `nextCursor` generation.
- Client: integration test that simulates `onMenuScrollToBottom` fetching successive pages and appending items.

## Rollout plan

1. Add the new API and implement server logic behind a feature flag (or by detecting `cursor` param presence). Keep old behaviour otherwise.
2. Update client `TransactionRow` to use incremental loading.
3. Remove feature flag and compatibility scaffolding after verification.
