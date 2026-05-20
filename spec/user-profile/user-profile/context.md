# User Profile — Context

## Problem

Users need a coherent profile-management feature for editing identity details and user preferences that shape application behavior. The feature must replace the placeholder `/settings/profile` experience with a user-scoped workflow for profile CRUD, avatar management, and preference updates without blurring ownership between auth, session, and profile concerns.

---

## Domain Dependencies

### User-profile domain HLD

This feature depends on the shared rules in `spec/user-profile/hld.md`, especially:

- `User Model Architecture`
- `User Settings and Preference Patterns`
- `Cross-Domain Dependencies`
- `App-Wide Behavior Effects`

### Auth and session management

The feature relies on authenticated server-side user resolution, protected profile mutations, and session refresh behavior after name/avatar changes.

### Shared storage infrastructure

Avatar uploads depend on the existing storage adapter pattern so uploaded media can be managed consistently across local and S3-backed environments.

### Financial display consumers

The feature owns preference editing, while reporting, ledger, and summary flows consume the resulting `preferredCurrency`, `fiscalYearType`, and `timezone` values.

---

## Scope Boundary

### In scope

- View and update profile fields on the current authenticated user
- Manage uploaded avatar state and fallback behavior
- Edit preferences that affect currency display, fiscal-year defaults, and time context
- Support password changes for credentials-based users
- Refresh profile-facing UI after identity changes

### Out of scope

- Email change and verification flows
- OAuth provider linking/unlinking
- Two-factor authentication
- Account deletion
- Notification preferences
- Non-profile feature settings owned elsewhere

---

## Feature Outcome

The completed feature should give the authenticated user a single profile surface that safely edits profile metadata and preferences while preserving clean boundaries:

- auth/session identifies the user,
- user-profile owns editable profile data and preferences,
- downstream features read those preferences to shape rendering and defaults.

Implementation detail, API contracts, and file inventory live in `spec/user-profile/user-profile/lld.md` only.
