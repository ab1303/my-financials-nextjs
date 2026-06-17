# Calendar Management Low-Level Design

## Phase Map
| Phase                | Files                                                                                 | Description                                 | Depends On         |
|----------------------|--------------------------------------------------------------------------------------|---------------------------------------------|-------------------|
| List Years           | page.tsx, CalendarTableClient.tsx                                                    | Display all calendar years                  | -                 |
| Create/Edit Year     | form.tsx, _schema.ts, _types.ts, CalendarClientWrapper.tsx                           | Add/edit year, validate, handle lock        | List Years        |
| Lock/Unlock Year     | CalendarClientWrapper.tsx, Server Actions                                            | Lock/unlock year, enforce constraints       | Create/Edit Year  |
| Delete Year          | CalendarClientWrapper.tsx, Server Actions                                            | Delete year if not locked                   | List Years        |
| Backend CRUD         | calendar-year.controller.ts, trpc/router/calendar-year.ts                            | Data access, validation, lock logic         | All UI phases     |

## Key TypeScript Interfaces
```typescript
export interface CalendarYear {
  id: string;
  description: string;
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
  type: 'FISCAL' | 'ANNUAL' | 'ZAKAT';
  lockedAt?: string;
}
```

## Key Zod Schemas
```typescript
import { z } from 'zod';

export const calendarYearSchema = z.object({
  description: z.string().min(1),
  fromYear: z.number().int(),
  fromMonth: z.number().int().min(1).max(12),
  toYear: z.number().int(),
  toMonth: z.number().int().min(1).max(12),
  type: z.enum(['FISCAL', 'ANNUAL', 'ZAKAT']),
});
```

## TDD Test Cases
| Test                        | Type    | Verifies                                 |
|-----------------------------|---------|------------------------------------------|
| Create valid year           | unit    | Year is created and listed               |
| Lock year prevents edit     | unit    | Locked year cannot be edited/deleted     |
| Only one unlocked per type  | unit    | Enforces single unlocked year per type   |

## File Inventory
| File                                         | Status   | Description                                 |
|----------------------------------------------|----------|---------------------------------------------|
| page.tsx                                    | ✅ BUILT | Server Component, loads years, passes props |
| CalendarClientWrapper.tsx                    | ✅ BUILT | Client wrapper, manages form state/actions  |
| CalendarTableClient.tsx                      | ✅ BUILT | Table of years, action columns              |
| form.tsx                                    | ✅ BUILT | Calendar year form                          |
| _schema.ts                                  | ✅ BUILT | Zod schema for form                         |
| _types.ts                                   | ✅ BUILT | TypeScript types                            |
| calendar-year.controller.ts                  | ✅ BUILT | CRUD handlers for calendar years            |
| trpc/router/calendar-year.ts                 | ✅ BUILT | tRPC router for calendar years              |