# User Profile — Low Level Design

---

## Phase Map

| Phase | Name | Dependencies | Deliverables |
|---|---|---|---|
| 1 | Schema + tRPC Router | None | Prisma migration, tRPC router, service layer, types, schemas |
| 2 | Core Profile Form | Phase 1 | ProfileClient, ProfileForm, ProfileSection, page.tsx update |
| 3 | Avatar Upload | Phase 1 | AvatarUpload component, storage adapter prefix support, upload/delete procedures |
| 4 | Security Section | Phase 1 | ChangePasswordForm, credentials detection, bcrypt password change |

---

## Phase 1 — Schema + tRPC Router

### 1.1 Prisma Migration

**File to modify:** `prisma/schema.prisma`

Add to `User` model after the `role` field:

```prisma
  // Extended profile fields
  phone                 String?
  bio                   String?               @db.Text
  timezone              String?               @default("Australia/Sydney")
  linkedInUrl           String?
  preferredCurrency     CurrencyEnumType?     @default(AUD)
  fiscalYearType        CalendarEnumType?     @default(FISCAL)
  avatarStorageUrl      String?
  avatarStorageProvider StorageProviderEnum?
```

Migration command:

```bash
pnpm prisma migrate dev --name add_user_profile_fields
```

**Notes:**
- All fields nullable with defaults — non-destructive migration
- Reuses existing enums: `CurrencyEnumType`, `CalendarEnumType`, `StorageProviderEnum`
- No indexes needed (profile is always fetched by `userId` PK)
- Stop dev server before running migration to avoid EPERM errors on Windows

---

### 1.2 Types

**File to create:** `src/app/(authorized)/settings/profile/_types.ts`

```typescript
import type {
  CurrencyEnumType,
  CalendarEnumType,
  StorageProviderEnum,
} from '@prisma/client';

export interface UserProfileData {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;            // OAuth avatar URL
  phone: string | null;
  bio: string | null;
  timezone: string | null;
  linkedInUrl: string | null;
  preferredCurrency: CurrencyEnumType | null;
  fiscalYearType: CalendarEnumType | null;
  avatarStorageUrl: string | null;
  avatarStorageProvider: StorageProviderEnum | null;
  createdAt: string;               // ISO string
  isCredentialsUser: boolean;      // true if user has local password (not OAuth-only)
}

export interface UpdateProfileInput {
  name: string;
  phone?: string | null;
  bio?: string | null;
  timezone: string;
  linkedInUrl?: string | null;
  preferredCurrency: CurrencyEnumType;
  fiscalYearType: CalendarEnumType;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface UploadAvatarInput {
  fileBase64: string;              // base64-encoded image data
  mimeType: string;
  fileName: string;
}
```

---

### 1.3 Zod Schemas

**File to create:** `src/app/(authorized)/settings/profile/_schema.ts`

```typescript
import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less'),
  phone: z
    .string()
    .regex(/^\+?[\d\s\-()]{7,20}$/, 'Invalid phone number format')
    .nullish()
    .transform((v) => v || null),
  bio: z
    .string()
    .max(500, 'Bio must be 500 characters or less')
    .nullish()
    .transform((v) => v || null),
  timezone: z.string().min(1, 'Timezone is required'),
  linkedInUrl: z
    .string()
    .url('Must be a valid URL')
    .regex(
      /^https?:\/\/(www\.)?linkedin\.com\/in\//,
      'Must be a LinkedIn profile URL (https://linkedin.com/in/...)',
    )
    .nullish()
    .transform((v) => v || null),
  preferredCurrency: z.enum(['AUD', 'USD']),
  fiscalYearType: z.enum(['FISCAL', 'ANNUAL']),
});

export type UpdateProfileFormValues = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain uppercase, lowercase, and a number',
      ),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

export const uploadAvatarSchema = z.object({
  fileBase64: z.string().min(1),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  fileName: z.string().min(1),
});
```

---

### 1.4 Service Layer

**File to create:** `src/server/services/user-profile/user-profile.service.ts`

```typescript
import type { PrismaClient } from '@prisma/client';
import type { UserProfileData, UpdateProfileInput } from
  '@/app/(authorized)/settings/profile/_types';
import {
  getStorageAdapter,
  getStorageProviderEnum,
} from '@/server/services/ai-import/image-storage.adapter';
import bcrypt from 'bcryptjs';

export async function getProfile(
  prisma: PrismaClient,
  userId: string,
): Promise<UserProfileData>;

export async function updateProfile(
  prisma: PrismaClient,
  userId: string,
  data: UpdateProfileInput,
): Promise<UserProfileData>;

export async function uploadAvatar(
  prisma: PrismaClient,
  userId: string,
  file: Buffer,
  mimeType: string,
  fileName: string,
): Promise<{ avatarUrl: string }>;

export async function deleteAvatar(
  prisma: PrismaClient,
  userId: string,
): Promise<void>;

export async function changePassword(
  prisma: PrismaClient,
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void>;
```

**Key implementation details:**

`getProfile`:
- `prisma.user.findUniqueOrThrow({ where: { id: userId } })`
- Select all profile fields plus `password` (to determine `isCredentialsUser`)
- `isCredentialsUser`: check if `password` is a valid bcrypt hash (starts with `$2a$` or `$2b$`) — OAuth users may have a placeholder string
- Return `UserProfileData` — never expose `password` hash to the client

`updateProfile`:
- `prisma.user.update({ where: { id: userId }, data })` with only allowed fields
- Returns updated `UserProfileData`

`uploadAvatar`:
- Get current user to check for existing `avatarStorageUrl`
- If existing avatar → call `adapter.deleteImage()` first
- Call `getStorageAdapter().uploadImage(file, mimeType, userId, fileName)` with prefix `"avatars"`
- `prisma.user.update({ avatarStorageUrl: result.storageUrl, avatarStorageProvider: getStorageProviderEnum() })`
- Return the new `avatarUrl`

`deleteAvatar`:
- Get current user's `avatarStorageUrl`
- If present → call `adapter.deleteImage(avatarStorageUrl)`
- `prisma.user.update({ avatarStorageUrl: null, avatarStorageProvider: null })`

`changePassword`:
- Fetch user's current password hash
- `bcrypt.compare(currentPassword, existingHash)` — throw TRPCError `UNAUTHORIZED` if mismatch
- `bcrypt.hash(newPassword, 12)` — hash new password
- `prisma.user.update({ password: hashedNewPassword })`

---

### 1.5 tRPC Router

**File to create:** `src/server/trpc/router/user-profile.ts`

```typescript
import { router, protectedProcedure } from '@/server/trpc/trpc';
import { TRPCError } from '@trpc/server';
import { updateProfileSchema, changePasswordSchema, uploadAvatarSchema }
  from '@/app/(authorized)/settings/profile/_schema';
import * as profileService from
  '@/server/services/user-profile/user-profile.service';

export const userProfileRouter = router({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    return profileService.getProfile(ctx.prisma, ctx.session.user.id);
  }),

  updateProfile: protectedProcedure
    .input(updateProfileSchema)
    .mutation(async ({ ctx, input }) => {
      return profileService.updateProfile(ctx.prisma, ctx.session.user.id, input);
    }),

  uploadAvatar: protectedProcedure
    .input(uploadAvatarSchema)
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.fileBase64, 'base64');
      // 5MB limit
      if (buffer.length > 5 * 1024 * 1024) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'File size must be under 5MB',
        });
      }
      return profileService.uploadAvatar(
        ctx.prisma,
        ctx.session.user.id,
        buffer,
        input.mimeType,
        input.fileName,
      );
    }),

  deleteAvatar: protectedProcedure.mutation(async ({ ctx }) => {
    await profileService.deleteAvatar(ctx.prisma, ctx.session.user.id);
    return { success: true };
  }),

  changePassword: protectedProcedure
    .input(changePasswordSchema)
    .mutation(async ({ ctx, input }) => {
      await profileService.changePassword(
        ctx.prisma,
        ctx.session.user.id,
        input.currentPassword,
        input.newPassword,
      );
      return { success: true };
    }),
});
```

**File to modify:** `src/server/trpc/router/_app.ts`

```typescript
import { userProfileRouter } from './user-profile';

// Add to appRouter:
userProfile: userProfileRouter,
```

---

### 1.6 Image Storage Adapter — Prefix Support

**File to modify:** `src/server/services/ai-import/image-storage.adapter.ts`

The `LocalStorageAdapter` currently hardcodes `uploads/ai-imports`. The `S3StorageAdapter` hardcodes prefix `ai-imports/`. To reuse for avatars:

**Option A (minimal change):** Add an optional `pathPrefix` parameter to `uploadImage`:

```typescript
export interface IImageStorageAdapter {
  uploadImage(
    file: Buffer,
    mimeType: string,
    userId: string,
    originalFileName: string,
    pathPrefix?: string,     // NEW — defaults to 'ai-imports'
  ): Promise<StorageResult>;
  // ... rest unchanged
}
```

Both `LocalStorageAdapter` and `S3StorageAdapter` use `pathPrefix ?? 'ai-imports'` in their path construction.

**Option B (factory):** Create `getAvatarStorageAdapter()` that wraps the base adapter with a fixed prefix. This avoids modifying the existing interface signature.

**Recommendation:** Option A for simplicity — single parameter addition, backward compatible with default.

---

### Phase 1 — TDD Test Cases

| # | Test description | Test type | What it verifies |
|---|---|---|---|
| 1 | `getProfile` returns all profile fields for authenticated user | Integration | Service returns correct shape with `isCredentialsUser` flag |
| 2 | `updateProfile` updates allowed fields and ignores unknown fields | Integration | Only whitelisted fields are written to DB |
| 3 | `updateProfile` rejects invalid LinkedIn URL format | Unit | Zod schema rejects non-LinkedIn URLs |
| 4 | `updateProfile` rejects empty name | Unit | Zod schema enforces `min(1)` on name |
| 5 | `changePassword` fails with wrong current password | Integration | bcrypt comparison rejects mismatch, returns UNAUTHORIZED |
| 6 | `changePassword` succeeds with correct current password | Integration | New hash stored in DB, bcrypt.compare succeeds with new password |
| 7 | `uploadAvatar` rejects files over 5MB | Unit | TRPCError BAD_REQUEST thrown for oversized payload |
| 8 | `uploadAvatar` stores file and updates User record | Integration | `avatarStorageUrl` and `avatarStorageProvider` are non-null after upload |
| 9 | `deleteAvatar` clears `avatarStorageUrl` from User | Integration | Fields are null after delete |
| 10 | Unauthenticated request to `getProfile` returns 401 | Integration | `protectedProcedure` rejects unauthenticated calls |

---

## Phase 2 — Core Profile Form

### 2.1 ProfileSection Component

**File to create:** `src/app/(authorized)/settings/profile/_components/ProfileSection.tsx`

```typescript
'use client';

interface ProfileSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function ProfileSection({ title, description, children }: ProfileSectionProps) {
  return (
    <div className="rounded-xl border border-border bg-card shadow p-6">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </div>
  );
}
```

---

### 2.2 ProfileForm Component

**File to create:** `src/app/(authorized)/settings/profile/_components/ProfileForm.tsx`

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { trpc } from '@/server/trpc/client';
import {
  updateProfileSchema,
  type UpdateProfileFormValues,
} from '../_schema';
import type { UserProfileData } from '../_types';

interface ProfileFormProps {
  profile: UserProfileData;
  onProfileUpdated: () => void;
}
```

**Form fields mapping:**

| Field | Input type | Default value | Validation |
|---|---|---|---|
| `name` | `<input type="text">` | `profile.name ?? ''` | Required, max 100 |
| `email` | `<input type="email" disabled>` | `profile.email ?? ''` | Read-only (not in schema) |
| `phone` | `<input type="tel">` | `profile.phone ?? ''` | Optional, phone regex |
| `bio` | `<textarea>` | `profile.bio ?? ''` | Optional, max 500 |
| `linkedInUrl` | `<input type="url">` | `profile.linkedInUrl ?? ''` | Optional, LinkedIn URL pattern |
| `timezone` | `<select>` | `profile.timezone ?? 'Australia/Sydney'` | Required, IANA timezone |
| `preferredCurrency` | Radio group (AUD / USD) | `profile.preferredCurrency ?? 'AUD'` | Required |
| `fiscalYearType` | Radio group (FISCAL / ANNUAL) | `profile.fiscalYearType ?? 'FISCAL'` | Required |

**Form layout (two-column on desktop, single-column on mobile):**

```
┌──────────────────────────────────────────────┐
│ Personal Information                         │
├─────────────────────┬────────────────────────┤
│ Full Name *         │ Phone                  │
├─────────────────────┴────────────────────────┤
│ Email (read-only, greyed out)                │
├──────────────────────────────────────────────┤
│ Bio (textarea, 3 rows)                       │
├──────────────────────────────────────────────┤
│ LinkedIn URL                                 │
├─────────────────────┬────────────────────────┤
│ Timezone (select)   │ Preferred Currency     │
├─────────────────────┤ (○ AUD  ○ USD)         │
│ Fiscal Year Type    │                        │
│ (○ Jul–Jun  ○ Jan–Dec)                       │
├──────────────────────────────────────────────┤
│                              [ Save Changes ]│
└──────────────────────────────────────────────┘
```

**Mutation handler:**

```typescript
const updateMutation = trpc.userProfile.updateProfile.useMutation({
  onSuccess: () => {
    toast.success('Profile updated successfully');
    onProfileUpdated(); // triggers refetch + session refresh
  },
  onError: (error) => {
    toast.error(error.message);
  },
});
```

**Timezone dropdown generation:**

```typescript
const timezones = Intl.supportedValuesOf('timeZone');
// Render as <select> with search/filter via native browser or react-select
```

---

### 2.3 ProfileClient Component

**File to create:** `src/app/(authorized)/settings/profile/_components/ProfileClient.tsx`

```typescript
'use client';

import { trpc } from '@/server/trpc/client';
import { ProfileSection } from './ProfileSection';
import { ProfileForm } from './ProfileForm';
import { AvatarUpload } from './AvatarUpload';
import { ChangePasswordForm } from './ChangePasswordForm';

export function ProfileClient() {
  const utils = trpc.useUtils();
  const { data: profile, isLoading } = trpc.userProfile.getProfile.useQuery();

  const handleProfileUpdated = () => {
    utils.userProfile.getProfile.invalidate();
    // Trigger NextAuth session refresh for nav bar
    // useSession().update() or window event
  };

  if (isLoading) return <ProfileSkeleton />;
  if (!profile) return <ErrorState />;

  return (
    <div className="space-y-6">
      <ProfileSection title="Avatar" description="Your profile photo">
        <AvatarUpload profile={profile} onAvatarChanged={handleProfileUpdated} />
      </ProfileSection>

      <ProfileSection
        title="Personal Information"
        description="Update your personal details and financial preferences"
      >
        <ProfileForm profile={profile} onProfileUpdated={handleProfileUpdated} />
      </ProfileSection>

      {profile.isCredentialsUser && (
        <ProfileSection
          title="Security"
          description="Change your password"
        >
          <ChangePasswordForm />
        </ProfileSection>
      )}
    </div>
  );
}
```

---

### 2.4 Page Update

**File to modify:** `src/app/(authorized)/settings/profile/page.tsx`

```typescript
import { ProfileClient } from './_components/ProfileClient';

export default function ProfilePage() {
  return (
    <main className="px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Profile
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your account settings and preferences
        </p>
      </div>
      <ProfileClient />
    </main>
  );
}
```

---

### Phase 2 — TDD Test Cases

| # | Test description | Test type | What it verifies |
|---|---|---|---|
| 1 | ProfileForm renders all fields with pre-filled values from profile data | Component | Form loads correctly with initial data |
| 2 | ProfileForm shows validation errors for empty name on submit | Component | Zod validation triggers error message on name field |
| 3 | ProfileForm disables email field (read-only) | Component | Email input has `disabled` attribute |
| 4 | ProfileForm calls `updateProfile` mutation with correct payload on submit | Component | tRPC mutation fires with form values |
| 5 | ProfileClient shows loading skeleton while profile loads | Component | Skeleton renders when `isLoading` is true |
| 6 | ProfileClient hides security section for non-credentials users | Component | `ChangePasswordForm` not rendered when `isCredentialsUser === false` |
| 7 | Timezone dropdown contains valid IANA timezone strings | Unit | `Intl.supportedValuesOf('timeZone')` populates select options |
| 8 | LinkedInUrl field rejects non-LinkedIn URLs | Unit | Zod schema rejects `https://twitter.com/user` |

---

## Phase 3 — Avatar Upload

### 3.1 AvatarUpload Component

**File to create:** `src/app/(authorized)/settings/profile/_components/AvatarUpload.tsx`

```typescript
'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/server/trpc/client';
import type { UserProfileData } from '../_types';

interface AvatarUploadProps {
  profile: UserProfileData;
  onAvatarChanged: () => void;
}
```

**Avatar display logic:**

```typescript
function getAvatarDisplay(profile: UserProfileData): {
  type: 'image' | 'initials';
  src?: string;
  initials?: string;
} {
  if (profile.avatarStorageUrl) {
    return { type: 'image', src: `/api/avatar/${profile.id}` };
  }
  if (profile.image) {
    return { type: 'image', src: profile.image };
  }
  const initials = (profile.name ?? profile.email ?? '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return { type: 'initials', initials };
}
```

**Upload flow:**

1. User clicks avatar or "Upload" button → opens hidden `<input type="file" accept="image/png,image/jpeg,image/webp">`
2. `onChange` → read file as base64 via `FileReader`
3. Validate file size client-side (< 5MB)
4. Show preview immediately (local `URL.createObjectURL`)
5. Call `trpc.userProfile.uploadAvatar.mutate({ fileBase64, mimeType, fileName })`
6. On success → `toast.success('Avatar updated')` + `onAvatarChanged()`
7. On error → revert preview, `toast.error()`

**Delete flow:**

1. User clicks "Remove" button (visible only when `avatarStorageUrl` exists)
2. Confirm via inline prompt or immediate action
3. Call `trpc.userProfile.deleteAvatar.mutate()`
4. On success → fallback to OAuth image or initials

**Component layout:**

```
┌───────────────────────────────┐
│  ┌──────┐                     │
│  │      │  Upload a photo     │
│  │ AVATAR│  JPG, PNG or WebP. │
│  │      │  Max 5MB.           │
│  └──────┘                     │
│  [Upload Photo] [Remove]      │
└───────────────────────────────┘
```

---

### 3.2 Avatar Serving Route

**File to create:** `src/app/api/avatar/[userId]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db';
import { getStorageAdapter } from '@/server/services/ai-import/image-storage.adapter';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } },
): Promise<NextResponse> {
  const session = await auth();
  if (!session || session.user.id !== params.userId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { avatarStorageUrl: true, avatarStorageProvider: true },
  });

  if (!user?.avatarStorageUrl) {
    return new NextResponse('Not found', { status: 404 });
  }

  const adapter = getStorageAdapter();
  const buffer = await adapter.getImageBuffer(user.avatarStorageUrl);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'image/jpeg', // detect from extension or store mimeType
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
```

---

### Phase 3 — TDD Test Cases

| # | Test description | Test type | What it verifies |
|---|---|---|---|
| 1 | AvatarUpload renders uploaded avatar when `avatarStorageUrl` is set | Component | Image element with correct src |
| 2 | AvatarUpload renders OAuth image when no uploaded avatar but `image` is set | Component | Falls back to OAuth image URL |
| 3 | AvatarUpload renders initials when no avatar and no OAuth image | Component | Initials badge shown with correct letters |
| 4 | AvatarUpload rejects files over 5MB client-side | Component | Error toast shown, mutation not called |
| 5 | AvatarUpload calls `uploadAvatar` mutation with base64 payload | Component | tRPC mutation fires with correct shape |
| 6 | AvatarUpload "Remove" button calls `deleteAvatar` mutation | Component | tRPC mutation fires, avatar display reverts to fallback |
| 7 | Avatar API route returns 401 for unauthenticated request | Integration | Route handler rejects without session |
| 8 | Avatar API route returns image buffer for authenticated user | Integration | Correct content-type and buffer returned |

---

## Phase 4 — Security Section

### 4.1 ChangePasswordForm Component

**File to create:** `src/app/(authorized)/settings/profile/_components/ChangePasswordForm.tsx`

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { trpc } from '@/server/trpc/client';
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from '../_schema';

export function ChangePasswordForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
  });

  const changeMutation = trpc.userProfile.changePassword.useMutation({
    onSuccess: () => {
      toast.success('Password changed successfully');
      reset();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (data: ChangePasswordFormValues) => {
    changeMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
      {/* Current Password */}
      {/* New Password */}
      {/* Confirm New Password */}
      {/* Submit button */}
    </form>
  );
}
```

**Form layout:**

```
┌──────────────────────────────────┐
│ Security                         │
│ Change your password             │
├──────────────────────────────────┤
│ Current Password                 │
│ [••••••••••••]                   │
│                                  │
│ New Password                     │
│ [••••••••••••]                   │
│ Must be 8+ chars with upper,     │
│ lower, and number                │
│                                  │
│ Confirm New Password             │
│ [••••••••••••]                   │
│                                  │
│ [ Change Password ]              │
└──────────────────────────────────┘
```

---

### 4.2 Credentials User Detection

In `user-profile.service.ts` → `getProfile`:

```typescript
// Detect if user is credentials-based
const isCredentialsUser = user.password.startsWith('$2a$') ||
                          user.password.startsWith('$2b$');
```

OAuth users may have a placeholder password (e.g., empty string or non-bcrypt value). This heuristic works because bcrypt hashes always start with `$2a$` or `$2b$`.

**Alternative approach:** Query the `Account` table:

```typescript
const oauthAccounts = await prisma.account.findMany({
  where: { userId },
  select: { provider: true },
});
const isCredentialsUser = oauthAccounts.length === 0;
```

**Recommendation:** Use both — prefer the `Account` table check as it's more explicit, with bcrypt check as a fallback.

---

### Phase 4 — TDD Test Cases

| # | Test description | Test type | What it verifies |
|---|---|---|---|
| 1 | ChangePasswordForm renders three password fields | Component | All inputs rendered with correct types |
| 2 | ChangePasswordForm shows error when passwords don't match | Component | Zod refine triggers on confirmPassword mismatch |
| 3 | ChangePasswordForm shows error for weak password (no uppercase) | Component | Zod regex validation rejects weak passwords |
| 4 | ChangePasswordForm calls `changePassword` mutation on valid submit | Component | tRPC mutation fires with correct payload |
| 5 | ChangePasswordForm resets after successful password change | Component | All fields cleared after mutation success |
| 6 | Service rejects password change when current password is wrong | Integration | TRPCError UNAUTHORIZED returned |
| 7 | Service accepts password change with correct current password | Integration | New bcrypt hash stored, verifiable with bcrypt.compare |
| 8 | OAuth user (no credentials) does not see ChangePasswordForm | Component | Section not rendered when `isCredentialsUser === false` |

---

## Integration Points

### NextAuth Session Refresh

After `updateProfile` or avatar changes, the session token contains stale `name`/`image`. The client must refresh:

```typescript
// In ProfileClient after successful mutation:
import { useSession } from 'next-auth/react';

const { update: updateSession } = useSession();

const handleProfileUpdated = async () => {
  utils.userProfile.getProfile.invalidate();
  await updateSession(); // triggers JWT callback to re-read DB
};
```

**Prerequisite:** The NextAuth `jwt` callback must re-fetch user data from DB when `trigger === 'update'`. Verify this in `src/server/auth.ts` or the auth config.

### Storage Adapter Reuse

The avatar upload reuses `IImageStorageAdapter` from `src/server/services/ai-import/image-storage.adapter.ts`. The adapter needs a minor modification to accept a path prefix:

- Local: stores in `uploads/avatars/{userId}/{uuid}.{ext}` instead of `uploads/ai-imports/...`
- S3: stores under key `avatars/{userId}/{uuid}.{ext}` instead of `ai-imports/...`

### tRPC Client Import

All components use `import { trpc } from '@/server/trpc/client'` — the existing tRPC client setup. No new providers needed.

---

## Edge Cases

| Edge case | Handling |
|---|---|
| No avatar, no OAuth image, no name | Display `"?"` as initials fallback |
| OAuth user clicks "Change Password" | Section is hidden; if bypassed via API, service checks `isCredentialsUser` and throws |
| Invalid LinkedIn URL (not linkedin.com) | Zod schema rejects with descriptive error message |
| Avatar upload with unsupported MIME type | Zod schema rejects (only `image/png`, `image/jpeg`, `image/webp` allowed) |
| Avatar upload exceeds 5MB | Client-side check prevents upload; server-side check in tRPC procedure as safety net |
| Concurrent profile updates | Last-write-wins (Prisma default); `updatedAt` timestamp tracks latest |
| Name changed but session shows old name | `updateSession()` call after mutation refreshes JWT |
| User deletes uploaded avatar, has OAuth image | Fallback chain: uploaded → OAuth → initials. Removing uploaded shows OAuth image |
| Timezone set to invalid value | Server Zod schema validates against known IANA strings |
| Empty phone/bio/linkedInUrl submitted | `nullish().transform()` converts empty strings to `null` in DB |
| `fiscalYearType` set to `ZAKAT` | UI only offers FISCAL and ANNUAL options; Zod schema rejects ZAKAT |
