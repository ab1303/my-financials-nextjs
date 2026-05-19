# hld.md

## Problem & Proposed Solution
The Bank Institution settings UI currently wastes space after removing obsolete address fields. The solution is to redesign the UI for efficient use of space, focusing on a compact, inline-add form for banks and a clear list of global bank institutions. All address-related logic will be removed from the bank institution flow, and only the name field will be required for banks. No migration is needed as address columns are shared with other institution types.

## Architecture Decisions
1. **Inline Add Form**: Use a compact, inline-add form for adding banks, improving UX and space efficiency.
2. **Table/List Display**: Display all global banks in a table/list below the form for clarity.
3. **Remove Address Logic**: All address-related logic and validation will be removed from the bank institution flow.
4. **Minimal Schema Change**: No migration; address columns remain for other institution types.
5. **TypeScript & T3 Compliance**: All changes will follow T3 stack and App Router conventions.

## Data Model Changes (Schema Diff)
- Remove address validation and usage from bank flows only (no Prisma migration):
  - UI: Only `name` required for banks
  - Controller/Schema: Only validate `name` for banks

## Component/Service Changes
- `form.tsx`: Redesign to compact inline-add, remove address fields
- `page.tsx`: Update layout for new UX
- `bank.controller.ts`: Remove address logic
- `bank.schema.ts`: Remove address validation
- `businessTypes.ts`: Remove address from BankType

## Success Criteria
- UI displays only name field for banks
- Inline-add form is compact and functional
- Table/list of banks is clear and up-to-date
- No address logic remains in bank flows
- No regression for user-specific institutions

## Out of Scope / Future Phases
| Item                                 | Reason/Notes                                 |
|--------------------------------------|----------------------------------------------|
| Dropping address columns             | Shared with philanthropy, not required now   |
| User-specific institution changes    | Not affected by this redesign                |
| Multi-field validation enhancements  | Not required for minimal bank model          |
