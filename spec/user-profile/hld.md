# User Profile — High Level Design

## Problem Statement

The `/settings/profile` page is a static placeholder with no backend or UI. Users have no way to manage their identity (name, avatar), set financial preferences (fiscal year, currency), or change their password. These preferences affect how financial data is displayed and calculated across the app — fiscal year determines ledger period boundaries, currency affects formatting, and timezone affects date rendering. Without a profile page, all these settings are either hardcoded or absent.

---

## Proposed Solution

Build a fully functional profile management page with four distinct sections: avatar management, personal/financial profile form, and a credentials-only password change section. The implementation extends the existing `User` Prisma model with new columns (no new tables), adds a dedicated tRPC router with five procedures, and creates a Client Component form powered by react-hook-form + zod. Avatar upload reuses the existing `IImageStorageAdapter` infrastructure from the AI import feature. The page follows the Client Wrapper pattern: the Server Component page renders a Client Component that fetches its own data via tRPC.

---

## Goals

- Allow users to set and update their display name, phone, bio, timezone, LinkedIn URL
- Allow users to set financial preferences: preferred currency (AUD/USD) and fiscal year type (FISCAL/ANNUAL)
- Provide avatar upload with fallback to OAuth image or initials-based avatar
- Allow credentials-based users to change their password
- Reflect profile changes in the NextAuth session (name, avatar) without requiring re-login

## Out of Scope

| Item | Rationale | Future Phase |
|---|---|---|
| Email change | Requires email verification flow; email is the auth identifier | Phase 2 |
| Two-factor authentication (2FA) | Phone field is a future hook but 2FA needs TOTP/SMS infrastructure | Phase 2 |
| Account deletion (danger zone) | Requires cascade deletion logic for all user data + confirmation flow | Phase 3 |
| Notification preferences | No email/push notification system exists yet | Phase 3 |
| OAuth provider management | Connecting/disconnecting OAuth providers needs NextAuth adapter work | Phase 2 |
| Profile photo cropping/resizing | MVP accepts raw uploads; image processing can be added later | Phase 2 |

---

## Architecture Decisions

### 1. Extend `User` model vs. separate `UserProfile` table

**Decision:** Add columns directly to the `User` model.

**Rationale:** The profile fields are 1:1 with the user and always loaded together. A separate table adds a JOIN on every profile read with no normalization benefit. The fields are all nullable with sensible defaults, so the migration is non-destructive (no existing data affected). This matches how `image` and `role` are already stored on `User`.

### 2. Avatar storage strategy — reuse `IImageStorageAdapter`

**Decision:** Reuse the existing `IImageStorageAdapter` from `src/server/services/ai-import/image-storage.adapter.ts` with a configurable path prefix.

**Rationale:** The adapter already handles local filesystem and S3 with upload/delete/retrieve. Adding a `pathPrefix` parameter (default `"ai-imports"`, avatar uses `"avatars"`) avoids duplicating storage logic. Both local and S3 adapters need only a minor change to accept a prefix. The `avatarStorageUrl` on User stores the relative path/S3 key; `avatarStorageProvider` stores `LOCAL` or `S3`.

### 3. Avatar display priority chain

**Decision:** `avatarStorageUrl` (user upload) → `image` (OAuth provider) → initials-based fallback.

**Rationale:** Users who uploaded a custom avatar expect it to take precedence over their Google/GitHub photo. OAuth users who haven't uploaded anything see their provider image. Credentials users with no upload see initials generated from their name. This three-tier fallback is standard in apps like Slack and Notion.

### 4. Fiscal year preference and its app-wide impact

**Decision:** Store `fiscalYearType` as `CalendarEnumType` on the user, defaulting to `FISCAL`.

**Rationale:** The existing `CalendarYear` model uses `CalendarEnumType` (ZAKAT, ANNUAL, FISCAL). The user's `fiscalYearType` preference determines which calendar type is used as default when creating new ledgers or filtering financial reports. `FISCAL` = Australian Jul–Jun, `ANNUAL` = Jan–Dec. `ZAKAT` remains a separate concept tied to Islamic calendar obligations. This preference is read at report/ledger creation time, not retroactively applied.

### 5. Password change — credentials users only

**Decision:** Show the change password section only when the user has a credentials-based account (i.e., has a hashed password, not an OAuth-only account).

**Rationale:** OAuth users authenticate via their provider and have no local password to change. The tRPC procedure verifies the current password via bcrypt before allowing the change, preventing unauthorized password resets even if the session is compromised. The detection heuristic: query `Account` table for the user — if no OAuth provider entries exist, they're a credentials user. Alternatively, check if `password` is a non-empty bcrypt hash (OAuth users get a placeholder).

### 6. Timezone storage format

**Decision:** Store as IANA timezone string (e.g., `"Australia/Sydney"`) with a default of `"Australia/Sydney"`.

**Rationale:** IANA identifiers are the standard for timezone handling in JavaScript (`Intl.DateTimeFormat`), PostgreSQL (`AT TIME ZONE`), and every major library. Storing the full identifier (not just a UTC offset) handles DST transitions correctly. The dropdown will use `Intl.supportedValuesOf('timeZone')` to generate options.

### 7. LinkedIn URL as optional social proof

**Decision:** Include a single optional `linkedInUrl` field (no Twitter/X or other social links).

**Rationale:** For a personal finance app, LinkedIn is the most relevant professional context — useful for tax/accounting professionals reviewing data. Adding multiple social fields adds form clutter for minimal value. A single URL field with basic validation (`https://linkedin.com/in/...` or `https://www.linkedin.com/in/...`) keeps it focused.

---

## Data Model Changes

### Schema diff

```prisma
model User {
  // ... existing fields unchanged ...

+ // Extended profile fields
+ phone                 String?
+ bio                   String?               @db.Text
+ timezone              String?               @default("Australia/Sydney")
+ linkedInUrl           String?
+ preferredCurrency     CurrencyEnumType?     @default(AUD)
+ fiscalYearType        CalendarEnumType?     @default(FISCAL)
+ avatarStorageUrl      String?
+ avatarStorageProvider StorageProviderEnum?

  // ... relations unchanged ...
}
```

No new enums, no new models, no relation changes.

### Migration

```bash
pnpm prisma migrate dev --name add_user_profile_fields
```

All new fields are nullable with defaults — zero-downtime migration, no data backfill needed.

---

## Component / Service Hierarchy

```
page.tsx (Server Component)
  └─ ProfileClient (Client Component, "use client")
       ├─ tRPC: userProfile.getProfile → loads all profile data
       │
       ├─ ProfileSection "Avatar"
       │   └─ AvatarUpload
       │        ├─ Avatar display (uploaded > OAuth > initials)
       │        ├─ Upload button → tRPC userProfile.uploadAvatar
       │        └─ Remove button → tRPC userProfile.deleteAvatar
       │
       ├─ ProfileSection "Personal Information"
       │   └─ ProfileForm
       │        ├─ Name (text input)
       │        ├─ Email (read-only display)
       │        ├─ Phone (text input, optional)
       │        ├─ Bio (textarea, optional)
       │        ├─ LinkedIn URL (text input, optional)
       │        ├─ Timezone (select dropdown)
       │        ├─ Preferred Currency (radio: AUD / USD)
       │        └─ Fiscal Year Type (radio: FISCAL / ANNUAL)
       │        └─ Save button → tRPC userProfile.updateProfile
       │
       └─ ProfileSection "Security" (credentials users only)
           └─ ChangePasswordForm
                ├─ Current Password
                ├─ New Password
                ├─ Confirm New Password
                └─ Change Password button → tRPC userProfile.changePassword
```

### tRPC Router Surface

```
userProfile
  .getProfile()                    → UserProfileData (query)
  .updateProfile(input)            → updated UserProfileData (mutation)
  .uploadAvatar(input)             → { avatarUrl: string } (mutation)
  .deleteAvatar()                  → { success: boolean } (mutation)
  .changePassword(input)           → { success: boolean } (mutation)
```

### Service Layer

```
src/server/services/user-profile/user-profile.service.ts
  ├─ getProfile(userId: string)
  ├─ updateProfile(userId: string, data: UpdateProfileInput)
  ├─ uploadAvatar(userId: string, file: Buffer, mimeType: string, fileName: string)
  ├─ deleteAvatar(userId: string)
  └─ changePassword(userId: string, currentPassword: string, newPassword: string)
```

---

## Success Criteria

| # | Criterion | Verification |
|---|---|---|
| 1 | Profile form loads with current user data pre-filled | `getProfile` returns all User profile fields; form shows them |
| 2 | User can update name, phone, bio, timezone, linkedInUrl, currency, fiscal year | `updateProfile` mutation succeeds; DB reflects changes |
| 3 | Avatar upload stores file via storage adapter and shows immediately | File exists in `uploads/avatars/` (local) or S3; UI renders uploaded image |
| 4 | Avatar delete removes file and falls back to OAuth image or initials | Storage file deleted; `avatarStorageUrl` cleared; UI shows fallback |
| 5 | Credentials user can change password | Old password verified (bcrypt); new password hashed and saved |
| 6 | OAuth user does not see password change section | `ChangePasswordForm` is conditionally rendered based on account type |
| 7 | Name/avatar changes reflect in nav bar without re-login | NextAuth session is refreshed after profile update |
| 8 | All form fields validate correctly | Zod schemas reject invalid phone formats, LinkedIn URLs, empty passwords |
| 9 | Dark mode renders correctly for all sections | All Tailwind utilities include `dark:` variants |
| 10 | Page builds without errors in production | `pnpm run build` succeeds after all changes |
