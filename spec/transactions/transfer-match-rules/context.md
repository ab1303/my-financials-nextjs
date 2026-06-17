# Transfer Match Rules — Context

## Problem
Manual linking of recurring inter-account transfers is time-consuming. Users need automated pattern matching based on transaction descriptions, amounts, and bank accounts.

## Architecture
- **Rules**: `TransferMatchRule` model stores criteria.
- **Matching**: `runTransferMatchRules()` service runs synchronously after import.
- **Audit**: `TransferMatchJobResult` tracks job execution outcomes.

## Scope
- Auto-matching of recurring inter-account transfers.
- Rule management UI.
- Audit log of matching jobs.
