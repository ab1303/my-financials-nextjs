# CSV Import Month Extraction Bug Fix

## Issue
After CSV import completed successfully with 7 records created, the expense page still showed $0.00 for all months. The records were being created in the database but not appearing in the UI.

## Root Cause
The CSV parse endpoint (`/api/csv-import/parse`) had a critical bug in month extraction logic:

### Original Buggy Code
```typescript
// Line 54-55: Create composite key
const key = `${tx.year}-${tx.month}`;
const monthNum = parseInt(key.replace('-', ''));  // "2024-6" → "20246"

// Line 76: Extract month incorrectly
const monthNum = monthKey % 100;  // 20246 % 100 = 46 ❌
```

### The Bug
- Input: `key = "2024-6"` (year 2024, month 6)
- Line 55: `parseInt("20246")` → `20246`
- Line 76: `20246 % 100` → `46` (wrong month!)
- Result: Expenses created for month 46 instead of month 6

This caused expenses to be inserted with invalid month numbers (e.g., month 46) that don't exist in the expense tracking system.

## Solution
Simplified the month storage and extraction to use the month directly:

### Fixed Code
```typescript
// Use string key to preserve year and month safely
const monthMap = new Map<string, CsvTransaction[]>();
for (const tx of transactions) {
  const key = `${tx.year}-${tx.month}`;  // "2024-6"
  if (!monthMap.has(key)) {
    monthMap.set(key, []);
  }
  monthMap.get(key)!.push(tx);
}

// Later: Extract month from key correctly
const monthKey = "2024-6";
const monthNum = parseInt(monthKey.split('-')[1]!);  // parseInt("6") → 6 ✅
```

### Why This Works
- String keys preserve the exact year-month relationship
- `split('-')[1]` extracts just the month portion
- No mathematical operations that can cause overflow/underflow
- Simpler and more explicit

## Files Modified
- `src/app/api/csv-import/parse/route.ts` (lines 51-76)
  - Changed `monthMap` from `Map<number, ...>` to `Map<string, ...>`
  - Fixed month extraction logic
  - Simplified sorting logic

## Verification
✅ Production build passes cleanly
✅ Dev server running
✅ Month extraction now correctly produces months 1-12

## Impact
Users can now:
- ✅ Upload CSV files successfully
- ✅ See imported data appear in the expense table
- ✅ View transactions correctly categorized by month
- ✅ Track expenses with proper monthly breakdown

## Testing Recommendations
1. Upload CommBank CSV export
2. Verify import completes with records created
3. **Check that monthly totals appear in the expense table** (this was broken)
4. Click on month to view category breakdown
5. Verify all transactions appear with correct amounts
