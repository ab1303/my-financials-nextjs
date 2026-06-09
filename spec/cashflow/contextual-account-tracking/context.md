# Contextual Account Tracking — Context

## Problem
Users were confused by the "Tracked" toggle in the Bank Accounts table due to its prominence and lack of explanation.

## Architecture
- **Controls**: `isTracked` flag on `FinancialAccount` model.
- **Surface**: Surfaced in OrphanResolutionPanel and Advanced Account Settings only.
- **Language**: Plain language (no "off-budget" jargon).

## Scope
- Contextual visibility of account tracking.
- Integration into transfer-matching logic.
- Advanced control section in account settings.
