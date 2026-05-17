# Bank Account Management — Low Level Design

## Phase Map

| Phase | Files | Description |
|---|---|---|
| **Phase 1** | `schema`, `service`, `controller`, `router`, `root.ts` | Backend: tRPC `bankAccount.list`, `bankAccount.create`, `bankAccount.delete` |
| **Phase 2** | `BankAccountsSection.tsx`, `form.tsx` | UI: table of accounts + inline create form below bank institution card |

---

## Phase 1 — Backend

### 1a. Zod Schema

**`src/server/schema/bank-account.schema.ts`**

```typescript
import { z } from 'zod';

export const createBankAccountSchema = z.object({
  name:   z.string().min(1, 'Account name is required').max(100),
  bankId: z.string().min(1, 'Bank is required'),
});

export const deleteBankAccountSchema = z.object({
  id: z.string().min(1),
});

export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;
export type DeleteBankAccountInput = z.infer<typeof deleteBankAccountSchema>;
```

### 1b. Service

**`src/server/services/bank-account.service.ts`**

```typescript
import { prisma } from '@/server/db/client';
import type { CreateBankAccountInput } from '@/server/schema/bank-account.schema';

export const createBankAccount = async (input: CreateBankAccountInput & { userId: string }) => {
  return prisma.bankAccount.create({
    data: { name: input.name, bankId: input.bankId, userId: input.userId },
    include: { bank: { select: { name: true } } },
  });
};

export const getBankAccounts = async (userId: string) => {
  return prisma.bankAccount.findMany({
    where: { userId },
    include: {
      bank: { select: { name: true } },
      _count: { select: { transactions: true } },
    },
    orderBy: [{ bank: { name: 'asc' } }, { name: 'asc' }],
  });
};

export const deleteBankAccount = async (id: string, userId: string) => {
  // Guard: only delete if owned by this user
  return prisma.bankAccount.delete({
    where: { id, userId },
  });
};
```

### 1c. Controller

**`src/server/controllers/bank-account.controller.ts`**

```typescript
import { TRPCError } from '@trpc/server';
import {
  createBankAccount,
  getBankAccounts,
  deleteBankAccount,
} from '@/server/services/bank-account.service';
import type { CreateBankAccountInput, DeleteBankAccountInput } from '@/server/schema/bank-account.schema';

export const listBankAccountsHandler = async (userId: string) => {
  return getBankAccounts(userId);
};

export const createBankAccountHandler = async (
  input: CreateBankAccountInput,
  userId: string,
) => {
  try {
    return await createBankAccount({ ...input, userId });
  } catch (e: unknown) {
    // Prisma unique constraint violation code
    if ((e as { code?: string }).code === 'P2002') {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'An account with this name already exists at this bank.',
      });
    }
    throw e;
  }
};

export const deleteBankAccountHandler = async (
  input: DeleteBankAccountInput,
  userId: string,
) => {
  return deleteBankAccount(input.id, userId);
};
```

### 1d. tRPC Router

**`src/server/trpc/router/bank-account.ts`**

```typescript
import { router, protectedProcedure } from '@/server/trpc/trpc';
import {
  createBankAccountSchema,
  deleteBankAccountSchema,
} from '@/server/schema/bank-account.schema';
import {
  listBankAccountsHandler,
  createBankAccountHandler,
  deleteBankAccountHandler,
} from '@/server/controllers/bank-account.controller';

export const bankAccountRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    listBankAccountsHandler(ctx.session.user.id),
  ),

  create: protectedProcedure
    .input(createBankAccountSchema)
    .mutation(({ input, ctx }) =>
      createBankAccountHandler(input, ctx.session.user.id),
    ),

  delete: protectedProcedure
    .input(deleteBankAccountSchema)
    .mutation(({ input, ctx }) =>
      deleteBankAccountHandler(input, ctx.session.user.id),
    ),
});
```

### 1e. Register in root

**`src/server/trpc/root.ts`** — add import and registration:

```typescript
import { bankAccountRouter } from './router/bank-account';

export const appRouter = createTRPCRouter({
  // ... existing routers ...
  bankAccount: bankAccountRouter,
});
```

### Test Cases — Phase 1

| Test | Type | Verifies |
|---|---|---|
| `bankAccount.list` returns empty array for new user | Unit | No rows, no crash |
| `bankAccount.create` with valid name + bankId → returns new row with `bank.name` | Unit | Happy path |
| `bankAccount.create` with duplicate name+bankId → throws `CONFLICT` with message | Unit | Unique constraint handling |
| `bankAccount.delete` with own accountId → deletes row | Unit | Auth-scoped delete |
| `bankAccount.delete` with another user's accountId → throws or returns 0 rows | Unit | Auth guard |

---

## Phase 2 — UI

### 2a. BankAccountsSection Component

**`src/app/(authorized)/settings/banks/_components/BankAccountsSection.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { trpc } from '@/server/trpc/client';
import { Card } from '@/components';
import { Label, TextInput } from '@/components/ui';
import { Button } from '@/components';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
import { createBankAccountSchema, type CreateBankAccountInput } from '@/server/schema/bank-account.schema';

export default function BankAccountsSection() {
  const utils = trpc.useUtils();

  // Queries
  const { data: accounts = [], isLoading } = trpc.bankAccount.list.useQuery();
  const { data: banks = [] } = trpc.bank.getAllBanks.useQuery();

  // Mutations
  const createMutation = trpc.bankAccount.create.useMutation({
    onSuccess: () => {
      toast.success('Bank account added');
      reset();
      void utils.bankAccount.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.bankAccount.delete.useMutation({
    onSuccess: () => {
      toast.success('Bank account removed');
      setDeleteConfirmId(null);
      void utils.bankAccount.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const deleteTarget = accounts.find((a) => a.id === deleteConfirmId);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateBankAccountInput>({
    resolver: zodResolver(createBankAccountSchema),
  });

  const onSubmit = (data: CreateBankAccountInput) => {
    createMutation.mutate(data);
  };

  const hasBanks = banks.length > 0;

  return (
    <>
      <Card>
        <Card.Header>
          <Card.Header.Title>Your Bank Accounts</Card.Header.Title>
          <p className="text-sm text-muted-foreground mt-1">
            Add the individual accounts you hold at each bank. These are used when importing CSV statements.
          </p>
        </Card.Header>

        <Card.Body>
          {/* Existing accounts table */}
          {!isLoading && accounts.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border mb-6">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted">
                  <tr>
                    {['Bank', 'Account Name', 'Transactions', ''].map((h) => (
                      <th key={h} className="cursor-default select-none px-4 py-3 font-medium text-foreground">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {accounts.map((acc) => (
                    <tr key={acc.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 text-muted-foreground">{acc.bank.name}</td>
                      <td className="px-4 py-3 text-foreground font-medium">{acc.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{acc._count.transactions}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setDeleteConfirmId(acc.id)}
                          aria-label={`Delete ${acc.name}`}
                          className="text-destructive hover:bg-destructive/10 rounded p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Create form */}
          {!hasBanks ? (
            <p className="text-sm text-muted-foreground">
              Add a bank institution above before creating a bank account.
            </p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
              <div>
                <Label htmlFor="bankId">Bank</Label>
                <select
                  id="bankId"
                  {...register('bankId')}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select a bank</option>
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                {errors.bankId && <p className="mt-1 text-xs text-destructive">{errors.bankId.message}</p>}
              </div>

              <div>
                <Label htmlFor="accountName">Account Name</Label>
                <TextInput
                  id="accountName"
                  placeholder="e.g. Everyday Savings"
                  error={!!errors.name}
                  {...register('name')}
                />
                {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
              </div>

              <Button type="submit" variant="primary" isLoading={createMutation.isPending}>
                Add Account
              </Button>
            </form>
          )}
        </Card.Body>
      </Card>

      <ConfirmationDialog
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => {
          if (deleteConfirmId) deleteMutation.mutate({ id: deleteConfirmId });
        }}
        title="Remove Bank Account?"
        message={
          deleteTarget && deleteTarget._count.transactions > 0
            ? `This account has ${deleteTarget._count.transactions} transaction(s) linked to it. Removing it will not delete those transactions, but they will no longer be associated with a bank account.`
            : `Remove "${deleteTarget?.name ?? ''}" from ${deleteTarget?.bank.name ?? ''}?`
        }
        confirmButtonText="Remove"
        variant="warning"
        isLoading={deleteMutation.isPending}
      />
    </>
  );
}
```

### 2b. form.tsx update

In `src/app/(authorized)/settings/banks/form.tsx`, add the import and render `<BankAccountsSection />` after the bank institution `<Card>` closing tag:

```typescript
import BankAccountsSection from './_components/BankAccountsSection';

// At the bottom of the returned JSX, after the existing </Card>:
<div className="mt-6">
  <BankAccountsSection />
</div>
```

### Test Cases — Phase 2

| Test | Type | Verifies |
|---|---|---|
| Page with no banks shows "Add a bank institution above first" prompt | Unit/snapshot | Empty state guard |
| Submitting form with valid bank + name → new row appears in table | E2E | Happy path |
| Submitting form with duplicate name → toast error shown | E2E | Unique constraint UX |
| Delete button click → confirmation dialog appears | Unit | Delete guard |
| Delete on account with 0 transactions → simple confirmation message | Unit | Safe delete message |
| Delete on account with N transactions → warns about N transactions | Unit | Risky delete message |
| After delete confirmed → row removed from table | E2E | Mutation + refetch |
| `/cashflow/transactions` CSV wizard shows newly added account in dropdown | E2E | End-to-end validation |

---

## Edge Cases

| Case | Behaviour |
|---|---|
| No bank institutions exist | Create form replaced with inline prompt |
| User tries to create duplicate | `P2002` caught in controller → `CONFLICT` tRPC error → toast |
| Delete account with transactions | Warning message in dialog; delete still proceeds (transactions preserved, FK set to null via `ON DELETE SET NULL` on `Transaction.bankAccountId`) |
| No bank accounts yet | Table not shown; only create form visible |
