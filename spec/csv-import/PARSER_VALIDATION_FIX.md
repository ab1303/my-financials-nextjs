# CSV Parser Validation Fix

## Issue
Users attempting to upload CommBank CSV exports directly from the netbank were receiving validation errors:
- **Error**: "Error parsing row 1: Invalid amount: "-2000.00""

This occurred because CommBank CSV exports use quoted fields (e.g., `"-2000.00"`) for values containing special characters, and the simple comma-split parser couldn't handle these correctly.

## Root Cause
The original CSV parser had two issues:

1. **Quoted Field Handling**: CommBank format uses quotes around fields to escape special characters and commas within field values. The naive split(',') approach would break quoted fields.
   - Example: A description like `"Payment, Rent"` would be split into two fields instead of one.

2. **Quote Character Handling**: Quoted amounts like `"-2000.00"` were being passed to `parseFloat()` without removing quotes, causing the parse to fail with "Invalid amount".

## Solution

### 1. Improved Field Parsing
Added a dedicated `parseCSVLine()` function that properly handles:
- Quoted fields (fields wrapped in double quotes)
- Escaped quotes within fields (represented as `""`)
- Comma delimiters only outside of quoted sections

```typescript
function parseCSVLine(line: string): string[] {
  // Parses quoted CSV fields correctly
  // Handles "," vs , correctly
  // Handles "" (escaped quote) vs " (quote toggle)
}
```

**Implementation Details:**
- Tracks `insideQuotes` state while iterating through characters
- Only treats commas as delimiters when not inside quotes
- Handles doubled quotes (`""`) as escaped quotes within quoted fields

### 2. Quote Stripping in Field Access
Updated `getField()` in `parseCsvRow()` to remove surrounding quotes:

```typescript
if (value.startsWith('"') && value.endsWith('"')) {
  value = value.slice(1, -1);
}
```

This ensures values like `"-2000.00"` become `-2000.00` before numeric parsing.

### 3. Better Error Messages
Improved error output to show quoted values for clarity:
- Before: `Invalid amount: -2000.00`
- After: `Invalid amount: "-2000.00"` (shows what was actually parsed)

## CommBank CSV Format

CommBank exports use the following format:

```csv
Date,Debit,Credit,Description,Balance
"01-06-2024","2000.00","",""Payment, electricity"",""1234.56""
"02-06-2024","50.00","","Groceries","1184.56"
```

Key characteristics:
- Fields are quoted when they contain special characters
- Negative amounts represented as debits (in separate columns) or negative values
- Description can contain commas, which requires field quoting
- Balance is always included for verification

## Validation Rules (After Fix)

The parser now correctly:

1. ✅ **Parses quoted fields**: Handles descriptions with commas
2. ✅ **Strips quotes**: Removes surrounding quotes before processing
3. ✅ **Handles negative amounts**: Accepts `-2000.00` format for debits
4. ✅ **Processes escaped quotes**: Handles `""` within quoted fields
5. ✅ **Case-insensitive headers**: Works with different header casing
6. ✅ **Skips empty lines**: Ignores blank rows in CSV
7. ✅ **Filters by transaction type**: Only imports debit transactions
8. ✅ **Normalizes amounts**: Converts to positive values internally

## Testing

The fix was validated against:
- Real CommBank exports (User's actual CSV: "Complete Access 01072024 - 30062025.csv")
- Quoted field handling
- Negative amounts
- Special characters in descriptions

## Files Modified

- `src/server/services/ai-import/csv-parser.service.ts`
  - Added `parseCSVLine()` function
  - Updated `getField()` to handle quotes
  - Improved error messages
  - Updated docstring to mention CommBank format handling

## Backward Compatibility

✅ **Fully backward compatible**
- Still accepts simple CSV without quotes
- Still processes standard CommBank formats
- Existing validation rules unchanged
- No API changes

## User Impact

Users can now:
- ✅ Upload CommBank CSV exports directly without manual editing
- ✅ Import files with descriptions containing commas
- ✅ See clearer error messages if validation fails
- ✅ Process real-world bank exports without format conversion
