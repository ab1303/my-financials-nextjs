# Brokerage Hybrid Model — Low-Level Design (LLD)

## Phase Map

| Phase | Files Changed | Description |
|-------|---------------|-------------|
| **Phase 1: Admin Brokerage Management** | `src/app/(authorized)/settings/brokerages/page.tsx`, `form.tsx`, `src/server/services/brokerage.service.ts`, `src/server/controllers/brokerage.controller.ts`, `src/server/trpc/router/brokerage.ts`, `src/server/schema/brokerage.schema.ts`, `src/server/trpc/router/_app.ts` | Clone bank infrastructure; admin can create global brokerages (`userId=null`) |
| **Phase 2: Hybrid Query Logic** | `src/server/trpc/router/business.ts` (`getBrokeragesWithAccounts`) | Update query to return global + user-owned brokerages using OR clause |
| **Phase 3: UI Grouping** | `src/app/(authorized)/assets/stocks/NewSnapshotModal.tsx`, `HoldingFormModal.tsx` | Dropdown shows "Popular Brokerages" (global) and "My Custom Brokerages" (user) sections |
| **Phase 4: Tests** | `src/__tests__/unit/brokerage.service.test.ts`, `src/__tests__/unit/brokerage.controller.test.ts`, `src/__tests__/unit/business.controller.test.ts` (update), `src/__tests__/integration/brokerage-hybrid.test.ts` | Test global creation, user creation, hybrid query, uniqueness, deletion |

---

## Phase 1: Admin Brokerage Management

### New Files

#### `src/server/schema/brokerage.schema.ts`
```typescript
import { object, string } from 'zod';
import type { TypeOf } from 'zod';

export const createBrokerageSchema = object({
  name: string({ required_error: 'Brokerage name is required' })
    .min(1, 'Brokerage name cannot be empty')
    .max(100, 'Brokerage name must be less than 100 characters'),
});

export const params = object({
  brokerageId: string({ required_error: 'Brokerage id is required' }),
});

export type CreateBrokerageInput = TypeOf<typeof createBrokerageSchema>;
export type ParamsInput = TypeOf<typeof params>;
```

#### `src/server/services/brokerage.service.ts`
```typescript
import type { Prisma, Business } from '@prisma/client';
import { prisma } from '../utils/prisma';

export const addBrokerageDetails = async (
  input: Omit<Prisma.BusinessUncheckedCreateInput, 'userId'>
) => {
  const result = await prisma.business.create({
    data: { ...input, userId: null, type: 'BROKERAGE' },
  });
  return result as Business;
};

export const getBrokerageDetails = async (
  where?: Partial<Prisma.BusinessWhereUniqueInput>,
  select?: Prisma.BusinessSelect
) => {
  const finalWhere: Partial<Prisma.BusinessWhereUniqueInput> = {
    ...where,
    type: 'BROKERAGE',
    userId: null, // Only global brokerages
  };
  return (await prisma.business.findMany({
    where: finalWhere,
    select,
  })) as Array<Business>;
};

export const deleteBrokerageDetails = async (id: string) => {
  // Check for dependent accounts
  const accountCount = await prisma.financialAccount.count({
    where: { institutionId: id },
  });
  if (accountCount > 0) {
    throw new Error(
      `Cannot delete brokerage: ${accountCount} account(s) depend on this institution`
    );
  }
  return await prisma.business.delete({
    where: { id, type: 'BROKERAGE', userId: null },
  });
};
```

#### `src/server/controllers/brokerage.controller.ts`
```typescript
import { handleCaughtError } from '@/server/utils/prisma';
import {
  addBrokerageDetails,
  deleteBrokerageDetails,
  getBrokerageDetails,
} from '@/server/services/brokerage.service';

import type {
  CreateBrokerageInput,
  ParamsInput,
} from '@/server/schema/brokerage.schema';

export const addBrokerageDetailsHandler = async ({
  input,
}: {
  input: CreateBrokerageInput;
}) => {
  try {
    const brokerageResult = await addBrokerageDetails({
      name: input.name,
    });
    return {
      status: 'success',
      data: {
        brokerage: brokerageResult,
      },
    };
  } catch (e) {
    handleCaughtError(e);
  }
};

export const allBrokerageDetailsHandler = async () => {
  try {
    const brokerageDetails = await getBrokerageDetails();
    return brokerageDetails;
  } catch (e) {
    handleCaughtError(e);
  }
};

export const removeBrokerageDetailsHandler = async ({
  params,
}: {
  params: ParamsInput;
}) => {
  try {
    await deleteBrokerageDetails(params.brokerageId);
  } catch (e) {
    handleCaughtError(e);
  }
};
```

#### `src/server/trpc/router/brokerage.ts`
```typescript
import { router, protectedProcedure } from '@/server/trpc/trpc';
import {
  allBrokerageDetailsHandler,
  addBrokerageDetailsHandler,
  removeBrokerageDetailsHandler,
} from '@/server/controllers/brokerage.controller';
import {
  createBrokerageSchema,
  params,
} from '@/server/schema/brokerage.schema';

export const brokerageRouter = router({
  saveBrokerageDetails: protectedProcedure
    .input(createBrokerageSchema)
    .mutation(({ input }) => addBrokerageDetailsHandler({ input })),
  getAllBrokerages: protectedProcedure.query(() => {
    return allBrokerageDetailsHandler();
  }),
  removeBrokerageDetails: protectedProcedure
    .input(params)
    .mutation(({ input }) => removeBrokerageDetailsHandler({ params: input })),
});
```

#### `src/app/(authorized)/settings/brokerages/page.tsx`
```typescript
import BrokeragesForm from './form';

export default function BrokeragesPage() {
  return (
    <main className='px-4 sm:px-6 lg:px-8 py-6'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold tracking-tight text-foreground'>
          Brokerage Institutions
        </h1>
        <p className='text-muted-foreground mt-1 text-sm'>
          Manage global brokerage institutions shared across all users
        </p>
      </div>
      <BrokeragesForm />
    </main>
  );
}
```

#### `src/app/(authorized)/settings/brokerages/form.tsx`
```typescript
'use client';

import { useState } from 'react';
import { Loader2, Trash2, TrendingUp, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import { Card, Button } from '@/components';
import { Label, TextInput } from '@/components/ui';
import { trpc } from '@/server/trpc/client';

export default function BrokeragesForm() {
  const queryClient = useQueryClient();
  const [brokerageName, setBrokerageName] = useState('');

  const getBrokeragesQuery = trpc.brokerage.getAllBrokerages.useQuery();

  const saveMutation = trpc.brokerage.saveBrokerageDetails.useMutation({
    onSuccess() {
      void queryClient.refetchQueries({
        queryKey: [['brokerage', 'getAllBrokerages']],
      });
      toast.success('Brokerage institution added');
      setBrokerageName('');
    },
    onError(error) {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.brokerage.removeBrokerageDetails.useMutation({
    onSuccess() {
      void queryClient.refetchQueries({
        queryKey: [['brokerage', 'getAllBrokerages']],
      });
      toast.success('Brokerage institution removed');
    },
    onError(error) {
      toast.error(error.message);
    },
  });

  const handleAdd = () => {
    const trimmed = brokerageName.trim();
    if (!trimmed) return;
    saveMutation.mutate({ name: trimmed });
  };

  const brokerages = getBrokeragesQuery.data ?? [];

  return (
    <Card>
      <Card.Header>
        <div className='flex justify-between text-left'>
          <Card.Header.Title>Brokerage Institutions</Card.Header.Title>
        </div>
        <p className='mt-1 text-sm text-muted-foreground'>
          Global institutions shared across all users. Pre-populate common
          brokerages for easier account setup.
        </p>
      </Card.Header>

      <Card.Body>
        {/* Inline add */}
        <div className='mb-6 flex items-end gap-3 max-w-md'>
          <div className='flex-1'>
            <Label htmlFor='brokerageName'>Brokerage Name</Label>
            <TextInput
              id='brokerageName'
              placeholder='e.g. Fidelity, Charles Schwab'
              value={brokerageName}
              onChange={(e) => setBrokerageName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
          </div>
          <Button
            variant='primary'
            type='button'
            isLoading={saveMutation.isPending}
            disabled={!brokerageName.trim() || saveMutation.isPending}
            onClick={handleAdd}
          >
            <Plus className='mr-1 h-4 w-4' aria-hidden='true' />
            Add
          </Button>
        </div>

        {/* Institution list */}
        {getBrokeragesQuery.isLoading ? (
          <div className='flex items-center gap-2 py-6 text-sm text-muted-foreground'>
            <Loader2 className='h-4 w-4 animate-spin' />
            Loading institutions…
          </div>
        ) : brokerages.length > 0 ? (
          <div className='overflow-hidden rounded-lg border border-border'>
            <table className='w-full text-sm'>
              <thead className='bg-muted'>
                <tr>
                  <th className='cursor-default select-none px-4 py-3 text-left font-medium text-foreground'>
                    Institution
                  </th>
                  <th className='w-12 px-4 py-3' />
                </tr>
              </thead>
              <tbody className='divide-y divide-border'>
                {brokerages.map((brokerage) => (
                  <tr key={brokerage.id} className='hover:bg-muted/50'>
                    <td className='flex items-center gap-2 px-4 py-3 text-foreground'>
                      <TrendingUp
                        className='h-4 w-4 flex-shrink-0 text-muted-foreground'
                        aria-hidden='true'
                      />
                      {brokerage.name}
                    </td>
                    <td className='px-4 py-3 text-right'>
                      {deleteMutation.isPending &&
                      deleteMutation.variables?.brokerageId ===
                        brokerage.id ? (
                        <Loader2 className='ml-auto h-4 w-4 animate-spin text-muted-foreground' />
                      ) : (
                        <button
                          type='button'
                          onClick={() =>
                            deleteMutation.mutate({ brokerageId: brokerage.id })
                          }
                          aria-label={`Remove ${brokerage.name}`}
                          className='rounded p-1 text-destructive hover:bg-destructive/10'
                        >
                          <Trash2 className='h-4 w-4' aria-hidden='true' />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className='flex flex-col items-center rounded-lg border border-dashed border-border py-10 text-center'>
            <TrendingUp
              className='mb-2 h-6 w-6 text-muted-foreground/50'
              aria-hidden='true'
            />
            <p className='text-sm font-medium text-foreground'>
              No brokerage institutions yet
            </p>
            <p className='mt-1 text-xs text-muted-foreground'>
              Add your first brokerage above to get started
            </p>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
```

### Modified Files

#### `src/server/trpc/router/_app.ts`
```typescript
// Add import
import { brokerageRouter } from './brokerage';

// Mount router
export const appRouter = router({
  // ... existing routers
  bank: bankRouter,
  brokerage: brokerageRouter, // ← NEW
  business: businessRouter,
  // ... rest
});
```

---

## Phase 2: Hybrid Query Logic

### Modified File

#### `src/server/trpc/router/business.ts` — `getBrokeragesWithAccounts`
```typescript
// BEFORE
getBrokeragesWithAccounts: protectedProcedure.query(async ({ ctx }) => {
  const { session } = ctx;
  const brokerages = await prisma.business.findMany({
    where: {
      userId: null,        // ❌ Only global
      type: 'BROKERAGE',
    },
    include: {
      financialAccounts: {
        where: { userId: session.user.id },
      },
    },
  });
  return brokerages;
}),

// AFTER
getBrokeragesWithAccounts: protectedProcedure.query(async ({ ctx }) => {
  const { session } = ctx;
  const brokerages = await prisma.business.findMany({
    where: {
      type: 'BROKERAGE',
      OR: [
        { userId: null },               // ✅ Global brokerages
        { userId: session.user.id },    // ✅ User's custom brokerages
      ],
    },
    include: {
      financialAccounts: {
        where: { userId: session.user.id },
      },
    },
  });
  return brokerages;
}),
```

**No change to `business.create` mutation** — already user-scoped:
```typescript
create: protectedProcedure
  .input(z.object({
    name: z.string().min(1),
    type: z.enum(['PHILANTHROPY', 'BROKERAGE']).optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    const { session } = ctx;
    const business = await prisma.business.create({
      data: {
        name: input.name,
        type: input.type ?? null,
        userId: session.user.id, // ✅ User-scoped (correct)
      },
    });
    return business;
  }),
```

---

## Phase 3: UI Grouping

### Modified Files

#### `src/app/(authorized)/assets/stocks/NewSnapshotModal.tsx` & `HoldingFormModal.tsx`

**Add helper to group institutions**:
```typescript
const groupInstitutions = (institutions: Array<{ id: string; name: string; userId: string | null }>) => {
  const global = institutions.filter(i => i.userId === null).map(i => ({ value: i.id, label: `🌍 ${i.name}` }));
  const custom = institutions.filter(i => i.userId !== null).map(i => ({ value: i.id, label: `👤 ${i.name}` }));
  return [...global, ...custom];
};

// In component
const institutionOptions = groupInstitutions(brokerageInstitutions);
```

**Or use `react-select` grouped options**:
```typescript
const institutionOptions = [
  {
    label: '🌍 Popular Brokerages',
    options: brokerageInstitutions
      .filter(i => i.userId === null)
      .map(i => ({ value: i.id, label: i.name })),
  },
  {
    label: '👤 My Custom Brokerages',
    options: brokerageInstitutions
      .filter(i => i.userId !== null)
      .map(i => ({ value: i.id, label: i.name })),
  },
];
```

---

## Phase 4: Tests

### Test Cases

| Test | Type | File | Verifies |
|------|------|------|----------|
| **Create global brokerage** | Unit | `brokerage.service.test.ts` | `addBrokerageDetails` creates with `userId=null` and `type='BROKERAGE'` |
| **Get global brokerages only** | Unit | `brokerage.service.test.ts` | `getBrokerageDetails` filters `userId=null` |
| **Delete with dependency check** | Unit | `brokerage.service.test.ts` | `deleteBrokerageDetails` throws if FinancialAccounts exist |
| **Create user-scoped brokerage** | Unit | `business.controller.test.ts` | `business.create` mutation sets `userId=session.user.id` for BROKERAGE type |
| **Hybrid query returns global + user** | Integration | `brokerage-hybrid.test.ts` | `getBrokeragesWithAccounts` returns both scopes; excludes other users' |
| **Uniqueness per scope** | Integration | `brokerage-hybrid.test.ts` | Global "Fidelity" + User A's "Fidelity" coexist; duplicate in same scope rejected |
| **Deletion fails gracefully** | Integration | `brokerage-hybrid.test.ts` | Deleting brokerage with accounts returns error |

---

## Integration Points

- **tRPC client**: No changes; API contracts unchanged
- **Stock modals**: Query `business.getBrokeragesWithAccounts` already returns correct shape; UI grouping is purely cosmetic
- **Navigation**: Add `/settings/brokerages` link to settings sidebar (future PR)

---

## Edge Cases

1. **User creates "Fidelity" before admin does**  
   → Both coexist (different `userId` values); user sees both in dropdown with labels
   
2. **Admin deletes global "Fidelity" with 100 user accounts**  
   → Deletion fails with error message; must reassign accounts first

3. **User tries to create duplicate custom "Interactive Brokers"**  
   → Unique constraint violation; toast error: "Brokerage name already exists"

4. **Migration from existing data**  
   → No action needed; existing global brokerages stay global; new inline creations are user-scoped

---

## Rollback Plan

If hybrid model causes issues:
1. Revert `business.ts` query to `userId: null` only
2. Update inline creation to set `userId: null` (revert to global-only)
3. Hide `/settings/brokerages` route

Schema unchanged; no data loss.
