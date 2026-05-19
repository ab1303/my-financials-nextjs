# High-Level Design: Date Entry UX Improvements for Stock Holdings

## Problem & Solution
Current UX for entering stock holdings is blocked by two issues: (1) the optional Sale Date field triggers a validation error when left empty, and (2) Buy Date is required, forcing users to leave the app to check broker statements. The solution is to fix Sale Date validation, make Buy Date optional, provide a month/year quick-pick with safe defaults, and add CGT education. Holdings remain editable after snapshot creation.

## Architecture Decisions
1. **Make buyDate optional** in forms and validation (null allowed in UI; DB change deferred).
2. **Month/year quick-pick**: Use HTML5 `<input type="month">` or simple text input for Buy Date.
3. **Safe default**: If user picks only month/year, store as first day of month (`new Date(year, month-1, 1)`).
4. **Fix saleDate validation**: Skip validation if field is empty/null.
5. **Editable holdings**: Holdings remain editable after snapshot creation; snapshot itself is immutable.
6. **CGT education warning**: Inline helper text explains why Buy Date matters for CGT; not a blocker.

## Data Model Changes
- `buyDate` is optional in Zod schema and UI; remains non-nullable in Prisma for now. Null buyDate handled as snapshot date in calculations.

## Validation Changes
- Zod: `buyDate` becomes `.optional()`, `saleDate` skips validation if empty/null.

## Success Criteria
- User can save holding with empty saleDate (no error).
- User can save holding without buyDate; defaults to snapshot date in calculations.
- Month/year input stores first day of month.
- CGT warning displays when buyDate is missing.
- Holdings editable post-snapshot.

## Out of Scope
- Automated buyDate estimation from broker imports (future phase).
