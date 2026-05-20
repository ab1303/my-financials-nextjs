# User Profile — Low Level Design

## Implementation Overview

The feature extends the existing profile settings flow with a protected tRPC surface, a user-profile service layer, and a client wrapper that renders editable sections for avatar, personal information, preferences, and password management.

### Key implementation rules

1. Resolve the target user from the authenticated session.
2. Keep the page server-first and move interactive state into client components.
3. Reuse shared storage infrastructure for avatar uploads.
4. Keep `image` as the OAuth-managed fallback while treating `avatarStorageUrl` as the user-uploaded override.
5. Refresh session-facing UI after name or avatar mutations.

---

## Data and API Contracts

### User model additions

The implementation expects user-profile fields to live on `User`, including:

- `phone`
- `bio`
- `timezone`
- `linkedInUrl`
- `preferredCurrency`
- `fiscalYearType`
- `avatarStorageUrl`
- `avatarStorageProvider`

### Router surface

`userProfile` exposes:

- `getProfile`
- `updateProfile`
- `uploadAvatar`
- `deleteAvatar`
- `changePassword`

### Validation requirements

- Name required, bounded for display safety
- Phone optional but normalized/validated
- LinkedIn URL optional but validated when present
- Timezone stored as an IANA identifier
- Currency and fiscal-year preferences constrained to supported enum values
- Password change requires current-password verification and confirmation matching
- Avatar uploads constrained by supported mime types and file-size limits

---

## Component and Service Shape

### Server/client boundary

- `page.tsx` stays a Server Component
- `ProfileClient` owns interactive state and tRPC queries/mutations
- Form and avatar/password sections remain client components beneath that wrapper

### Service responsibilities

- Read current profile state
- Update whitelisted profile fields only
- Upload and delete avatar assets through shared storage adapters
- Determine whether password change UI should be shown
- Verify and persist password changes securely

---

## File Inventory

### Files to create

| File | Role |
|---|---|
| `src/server/trpc/router/user-profile.ts` | Protected tRPC router for profile queries and mutations |
| `src/server/services/user-profile/user-profile.service.ts` | Service functions for profile CRUD, avatar operations, and password changes |
| `src/app/(authorized)/settings/profile/_components/ProfileClient.tsx` | Client wrapper that fetches profile data and coordinates updates |
| `src/app/(authorized)/settings/profile/_components/ProfileForm.tsx` | Form for editable profile fields and user preferences |
| `src/app/(authorized)/settings/profile/_components/AvatarUpload.tsx` | Avatar upload/delete UI with fallback display logic |
| `src/app/(authorized)/settings/profile/_components/ChangePasswordForm.tsx` | Credentials-only password change form |
| `src/app/(authorized)/settings/profile/_components/ProfileSection.tsx` | Shared section wrapper for the profile screen |
| `src/app/(authorized)/settings/profile/_types.ts` | Feature-local profile data types |
| `src/app/(authorized)/settings/profile/_schema.ts` | Zod schemas for profile mutations and forms |

### Files to modify

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add user-profile fields to the `User` model |
| `src/server/trpc/router/_app.ts` | Register the `userProfile` router |
| `src/app/(authorized)/settings/profile/page.tsx` | Replace the placeholder shell with the server-first profile page |
| `src/types/next-auth.d.ts` | Extend session-facing user typing for profile fields used in UI |
| `src/server/services/ai-import/image-storage.adapter.ts` | Reuse storage adapter patterns for avatar uploads if prefix support is needed |

---

## Delivery Phases

| Phase | Scope | Depends on |
|---|---|---|
| 1 | Schema and router/service foundation | None |
| 2 | Core profile form and client wrapper | Phase 1 |
| 3 | Avatar upload and fallback behavior | Phase 1 |
| 4 | Password change and credentials-only security section | Phase 1 |

---

## Acceptance Focus

- Profile data loads for the authenticated user only
- Editable preferences persist correctly and remain type-safe
- Avatar fallback order is preserved
- Password changes are gated to credentials users and require verification
- Session-facing UI reflects updated identity data
