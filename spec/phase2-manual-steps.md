# Phase 2 Implementation - Manual Steps Required

## Directory Creation

Due to tool limitations, the following directories need to be created manually:

```powershell
# Create the bank assets directory
New-Item -Path "src\app\(authorized)\cashflow\bank" -ItemType Directory -Force
```

Or manually create the folder structure:

```
src/app/(authorized)/cashflow/bank/
```

## Files to Create

Once the directory exists, create the following files:

### 1. page.tsx

Location: `src/app/(authorized)/cashflow/bank/page.tsx`

See: `spec/phase2-files/page.tsx`

### 2. BankAssetsClient.tsx

Location: `src/app/(authorized)/cashflow/bank/BankAssetsClient.tsx`

See: `spec/phase2-files/BankAssetsClient.tsx`

### 3. layout.tsx (optional)

Location: `src/app/(authorized)/cashflow/bank/layout.tsx`

See: `spec/phase2-files/layout.tsx`

## Navigation Update

The navigation already has an entry for Assets → Bank(s) pointing to `/cashflow/bank`.
See line 142 in `src/layouts/SideNav.tsx`:

```tsx
<SideNavLink name='Bank(s)' href='/cashflow/bank' className='border-b-0'>
  <IconBank />
</SideNavLink>
```

No changes needed to navigation.

## Next Steps

1. Create the directory structure
2. Copy the files from `spec/phase2-files/` to the appropriate locations
3. Test the page by navigating to `/cashflow/bank`
4. Verify the calendar year selectors work
5. Verify the accordion components display correctly
6. Continue with Phase 3 (Snapshot Creation)

## Testing

After files are in place:

```bash
pnpm run dev
```

Navigate to: http://localhost:3000/cashflow/bank

Expected behavior:

- Calendar type selector (FISCAL/ANNUAL/ZAKAT) displays
- Year dropdown populated from calendar years
- If no snapshot exists: "No snapshot recorded" message with "New Snapshot" button
- If snapshot exists: Grand total card + Bank accordions with account tables
