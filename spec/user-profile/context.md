# User Profile — Context

## Problem

The `/settings/profile` page is a placeholder shell with no functionality. Users cannot view or edit their name, avatar, timezone, currency preference, or fiscal year setting — all of which affect how the app displays and calculates financial data. There is no tRPC router, service layer, or client-side form for profile management.

---

## File Inventory

### Files to CREATE

| File | Role |
|---|---|
| `src/server/trpc/router/user-profile.ts` | tRPC router — `getProfile`, `updateProfile`, `uploadAvatar`, `deleteAvatar`, `changePassword` |
| `src/server/services/user-profile/user-profile.service.ts` | DB logic — profile CRUD, avatar storage, password change |
| `src/app/(authorized)/settings/profile/_components/ProfileClient.tsx` | Main Client Component — orchestrates sections, fetches via tRPC |
| `src/app/(authorized)/settings/profile/_components/ProfileForm.tsx` | react-hook-form + zod for profile fields |
| `src/app/(authorized)/settings/profile/_components/AvatarUpload.tsx` | Avatar upload/preview with initials fallback |
| `src/app/(authorized)/settings/profile/_components/ChangePasswordForm.tsx` | Password change form (credentials users only) |
| `src/app/(authorized)/settings/profile/_components/ProfileSection.tsx` | Reusable card section wrapper |
| `src/app/(authorized)/settings/profile/_types.ts` | TypeScript types for profile data |
| `src/app/(authorized)/settings/profile/_schema.ts` | Zod validation schemas |

### Files to MODIFY

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add profile fields to `User` model (`phone`, `bio`, `timezone`, `linkedInUrl`, `preferredCurrency`, `fiscalYearType`, `avatarStorageUrl`, `avatarStorageProvider`) |
| `src/server/trpc/router/_app.ts` | Register `userProfile` router |
| `src/app/(authorized)/settings/profile/page.tsx` | Replace shell with Server Component that renders `ProfileClient` |
| `src/types/next-auth.d.ts` | Extend `AugmentedUser` with new profile fields (name, image, avatarStorageUrl) |

---

## Schema Details

### Current `User` model

```prisma
model User {
  id            String        @id @default(cuid())
  name          String?
  email         String?       @unique
  emailVerified DateTime?
  image         String?
  password      String
  role          RoleEnumType? @default(user)

  createdAt           DateTime              @default(now())
  updatedAt           DateTime              @updatedAt
  accounts            Account[]
  sessions            Session[]
  individuals         Individual[]
  businesses          Business[]
  relationshipTypes   RelationshipType[]
  incomeLedgers       IncomeLedger[]
  expenseLedgers      ExpenseLedger[]
  bankAccounts        BankAccount[]
  bankBalanceSnapshots BankBalanceSnapshot[]
  portfolioSnapshots  PortfolioSnapshot[]
  importSessions      ImportSession[]
  importImages        ImportImage[]
  aiUsageLogs         AIUsageLog[]
  merchantCategoryMaps MerchantCategoryMap[]
  transactions        Transaction[]
}
```

### Proposed diff — new fields added to `User`

```prisma
model User {
  id            String        @id @default(cuid())
  name          String?
  email         String?       @unique
  emailVerified DateTime?
  image         String?                       // OAuth avatar URL (NextAuth managed)
  password      String
  role          RoleEnumType? @default(user)

+ // Extended profile fields
+ phone                 String?
+ bio                   String?               @db.Text
+ timezone              String?               @default("Australia/Sydney")
+ linkedInUrl           String?
+ preferredCurrency     CurrencyEnumType?     @default(AUD)
+ fiscalYearType        CalendarEnumType?     @default(FISCAL)
+ avatarStorageUrl      String?               // uploaded avatar (priority over image)
+ avatarStorageProvider StorageProviderEnum?   // LOCAL | S3

  createdAt           DateTime              @default(now())
  updatedAt           DateTime              @updatedAt
  // ... relations unchanged
}
```

### Existing enums reused (no new enums needed)

```prisma
enum CurrencyEnumType {
  AUD
  USD
}

enum CalendarEnumType {
  ZAKAT
  ANNUAL
  FISCAL
}

enum StorageProviderEnum {
  LOCAL
  S3
}
```

---

## Existing Patterns to Reuse

### tRPC router pattern

All routers in `src/server/trpc/router/` use `router()` and `protectedProcedure` from `@/server/trpc/trpc`, Zod input validation, and `ctx.session.user.id` for user scoping. Register in `_app.ts`.

### Image storage adapter

`src/server/services/ai-import/image-storage.adapter.ts` — provides `IImageStorageAdapter` with `uploadImage()`, `deleteImage()`, `getImageBuffer()`. Factory: `getStorageAdapter()` returns `LocalStorageAdapter` or `S3StorageAdapter` based on `IMAGE_STORAGE_PROVIDER` env var. Also `getStorageProviderEnum()` for Prisma enum value.

The avatar upload should reuse this adapter, storing files under `uploads/avatars/` (local) or `avatars/` S3 prefix instead of `ai-imports/`.

### Toast notifications

`sonner` — `toast.success()` / `toast.error()` used throughout for mutations.

### Form pattern

`react-hook-form` + `zod` resolver, used across the app for validated forms. Client Components with `"use client"` directive.

### UserProvider / useUser()

`src/app/(authorized)/UserProvider.tsx` — provides `AugmentedUser` via React context. Available in all `(authorized)` routes.

---

## Data Flow Diagrams

### Current flow (no profile)

```
User → /settings/profile → Static shell page ("coming soon")
NextAuth session → AugmentedUser { id, name, email, image, role }
  └─ image = OAuth provider URL or null
  └─ No profile fields available
```

### Proposed flow

```
User → /settings/profile → ProfileClient (Client Component)
  ├─ tRPC userProfile.getProfile → DB User record with all profile fields
  │   └─ Returns: name, email, phone, bio, timezone, linkedInUrl,
  │              preferredCurrency, fiscalYearType, image, avatarStorageUrl
  │
  ├─ ProfileForm (edit name, phone, bio, timezone, linkedInUrl, currency, fiscalYear)
  │   └─ Submit → tRPC userProfile.updateProfile
  │       └─ DB update → toast.success()
  │       └─ If name changed → NextAuth session update needed
  │
  ├─ AvatarUpload
  │   ├─ Display priority: avatarStorageUrl > image (OAuth) > initials fallback
  │   ├─ Upload → tRPC userProfile.uploadAvatar (base64 payload)
  │   │   └─ getStorageAdapter().uploadImage() → DB update avatarStorageUrl + provider
  │   └─ Delete → tRPC userProfile.deleteAvatar
  │       └─ getStorageAdapter().deleteImage() → DB clear avatarStorageUrl
  │
  └─ ChangePasswordForm (credentials users only)
      └─ Submit → tRPC userProfile.changePassword
          └─ Verify current password (bcrypt) → hash new → DB update
```

---

## Known Constraints

1. **NextAuth `image` field coexistence** — The `image` column is managed by NextAuth for OAuth providers. We must not overwrite it. The new `avatarStorageUrl` field is the user-uploaded avatar that takes display priority. Avatar resolution order: `avatarStorageUrl` → `image` → initials-based fallback.

2. **Storage infrastructure reuse** — The `IImageStorageAdapter` from `ai-import` handles local/S3 storage with cleanup. Avatar upload should reuse the same adapter with a different path prefix (`avatars/` instead of `ai-imports/`). The adapter currently hardcodes `ai-imports` prefix in `S3StorageAdapter` — the upload method may need a configurable prefix parameter or a separate factory call.

3. **Fiscal year enum tie-in** — `CalendarEnumType` already has `FISCAL` and `ANNUAL` values used by `CalendarYear`. Setting `fiscalYearType` on the user profile determines the default calendar type for new ledger entries. `FISCAL` = Australian financial year (Jul–Jun), `ANNUAL` = calendar year (Jan–Dec). `ZAKAT` is a separate Islamic calendar concept — not relevant to this preference.

4. **Currency enum reuse** — `CurrencyEnumType` already has `AUD` and `USD`. The `preferredCurrency` field on User sets the default for display formatting; it does not affect stored amounts (which are always in their original currency).

5. **Password change for credentials users only** — Users who signed in via OAuth (Google, GitHub) have no password to change. The UI must hide the change password section for OAuth users. Detection: check if the user has a non-null `password` field, or check `accounts` table for OAuth provider entries.

6. **Session refresh after name/avatar change** — When the user updates their name or avatar, the NextAuth session token contains stale data. The client should call `update()` from `useSession()` or trigger a session refresh to reflect changes in the nav bar avatar/name.

7. **Timezone storage** — Stored as IANA timezone string (e.g., `"Australia/Sydney"`). Used for date display formatting across the app. Default is `"Australia/Sydney"` for the Australian-oriented user base.
