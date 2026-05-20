# Import Session Date Range — Context

## Problem
Import history currently shows when an import was performed (`createdAt`) but not the transaction coverage period contained in that import. Users cannot quickly verify whether an import covered the intended date range.

## Domain Dependencies
- Uses `AIImportSession`/`ImportSession` lifecycle from [../hld.md](../hld.md).
- Uses transaction persistence outcomes from CSV and AI confirm flows.
- Uses shared reporting/listing surfaces that expose import session metadata.

## Scope
**In scope**
- Add nullable `startDate` and `endDate` to import session model.
- Compute min/max transaction dates after confirm and persist to session.
- Expose range in import-session listing APIs.
- Display coverage column in import history UI.

**Out of scope**
- Backfill of historical sessions.
- New filtering/sorting capabilities by coverage range.
- Editable/manual period assignment.
