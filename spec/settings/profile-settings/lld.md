# Profile Settings Low-Level Design

## Phase Map
| Phase              | Files                                         | Description                                 | Depends On         |
|--------------------|-----------------------------------------------|---------------------------------------------|-------------------|
| Display Profile    | page.tsx, ProfileClient.tsx                   | Show current user profile                   | -                 |
| Edit Profile       | ProfileClient.tsx, tRPC router, _schema.ts    | Edit name, email, currency, year, timezone  | Display Profile   |
| Avatar Upload      | ProfileClient.tsx, tRPC router                | Upload avatar (local/S3)                    | Edit Profile      |
| Backend CRUD       | trpc/router/user-profile.ts                   | Profile update logic, validation            | All UI phases     |

## Key TypeScript Interfaces
```typescript
export interface UserProfile {
  id: string;
  name?: string;
  email?: string;
  preferredCurrency?: 'AUD' | 'USD';
  fiscalYearType?: 'FISCAL' | 'ANNUAL' | 'ZAKAT';
  timezone?: string;
  avatarStorageUrl?: string;
  avatarStorageProvider?: 'LOCAL' | 'S3';
}
```

## Key Zod Schemas
```typescript
import { z } from 'zod';

export const userProfileSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  preferredCurrency: z.enum(['AUD', 'USD']).optional(),
  fiscalYearType: z.enum(['FISCAL', 'ANNUAL', 'ZAKAT']).optional(),
  timezone: z.string().optional(),
});
```

## TDD Test Cases
| Test                        | Type    | Verifies                                 |
|-----------------------------|---------|------------------------------------------|
| Update profile fields        | unit    | Fields update and persist                |
| Unique email enforced        | unit    | Duplicate email rejected                 |
| Avatar upload (S3/local)     | unit    | Avatar uploads and URL is set            |

## File Inventory
| File                                         | Status   | Description                                 |
|----------------------------------------------|----------|---------------------------------------------|
| page.tsx                                    | ✅ BUILT | Server shell, renders ProfileClient         |
| _components/ProfileClient.tsx                | ✅ BUILT | Client component, fetch/update profile      |
| _schema.ts                                  | 🔧 MODIFY| Add/adjust Zod schema for profile           |
| trpc/router/user-profile.ts                  | ✅ BUILT | tRPC router for profile update              |