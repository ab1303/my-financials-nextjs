'use client';

import { useState } from 'react';
import { trpc } from '@/server/trpc/client';
import { toast } from 'sonner';
import { Pencil, Trash2, RotateCcw, Check, X, Plus } from 'lucide-react';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';

type ExpenseCategoryRecord = {
  id: string;
  name: string;
  isActive: boolean;
  usageCount: number;
};

export default function ExpenseCategories() {
  const utils = trpc.useUtils();
  const { data: categories = [], isLoading } = trpc.expenseCategory.getAll.useQuery();

  const [addName, setAddName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ExpenseCategoryRecord | null>(null);

  const createMutation = trpc.expenseCategory.create.useMutation({
    onSuccess: () => {
      void utils.expenseCategory.getAll.invalidate();
      toast.success('Expense category added');
      setAddName('');
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = trpc.expenseCategory.update.useMutation({
    onSuccess: () => {
      void utils.expenseCategory.getAll.invalidate();
      toast.success('Expense category updated');
      setEditingId(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const removeMutation = trpc.expenseCategory.remove.useMutation({
    onSuccess: (result) => {
      void utils.expenseCategory.getAll.invalidate();
      toast.success(
        result.softDeleted
          ? 'Expense category deactivated (used by existing records)'
          : 'Expense category deleted',
      );
      setDeleteTarget(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const restoreMutation = trpc.expenseCategory.restore.useMutation({
    onSuccess: () => {
      void utils.expenseCategory.getAll.invalidate();
      toast.success('Expense category restored');
    },
    onError: (error) => toast.error(error.message),
  });

  const active = categories.filter((category) => category.isActive);
  const inactive = categories.filter((category) => !category.isActive);

  if (isLoading) {
    return <p className='text-sm text-muted-foreground dark:text-muted-foreground'>Loading…</p>;
  }

  return (
    <div className='max-w-lg'>
      <div className='mb-4 flex gap-2'>
        <input
          type='text'
          value={addName}
          onChange={(event) => setAddName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && addName.trim()) {
              createMutation.mutate({ name: addName.trim() });
            }
          }}
          placeholder='New expense category name…'
          className='flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring dark:border-input dark:bg-background dark:text-foreground dark:placeholder:text-muted-foreground dark:focus:ring-ring'
        />
        <button
          type='button'
          onClick={() => addName.trim() && createMutation.mutate({ name: addName.trim() })}
          disabled={!addName.trim() || createMutation.isPending}
          className='inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90'
        >
          <Plus className='h-4 w-4' />
          Add
        </button>
      </div>

      {active.length === 0 && inactive.length === 0 ? (
        <p className='text-sm text-muted-foreground dark:text-muted-foreground'>
          No expense categories yet. Add one above.
        </p>
      ) : (
        <ul className='divide-y divide-border rounded-md border border-border dark:divide-border dark:border-border'>
          {active.map((category) => (
            <li key={category.id} className='flex items-center gap-2 px-3 py-2'>
              {editingId === category.id ? (
                <>
                  <input
                    type='text'
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && editName.trim()) {
                        updateMutation.mutate({ id: category.id, name: editName.trim() });
                      }
                      if (event.key === 'Escape') {
                        setEditingId(null);
                      }
                    }}
                    autoFocus
                    className='flex-1 rounded border border-input bg-background px-2 py-1 text-sm text-foreground dark:border-input dark:bg-background dark:text-foreground'
                  />
                  <button
                    type='button'
                    onClick={() => editName.trim() && updateMutation.mutate({ id: category.id, name: editName.trim() })}
                    disabled={!editName.trim() || updateMutation.isPending}
                    className='text-primary hover:text-primary/80 dark:text-primary dark:hover:text-primary/80'
                    aria-label='Save'
                  >
                    <Check className='h-4 w-4' />
                  </button>
                  <button
                    type='button'
                    onClick={() => setEditingId(null)}
                    className='text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground'
                    aria-label='Cancel'
                  >
                    <X className='h-4 w-4' />
                  </button>
                </>
              ) : (
                <>
                  <span className='flex-1 text-sm text-foreground dark:text-foreground'>
                    {category.name}
                  </span>
                  <button
                    type='button'
                    onClick={() => {
                      setEditingId(category.id);
                      setEditName(category.name);
                    }}
                    className='text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground'
                    aria-label={`Edit ${category.name}`}
                  >
                    <Pencil className='h-4 w-4' />
                  </button>
                  <button
                    type='button'
                    onClick={() => setDeleteTarget(category)}
                    className='text-muted-foreground hover:text-destructive dark:text-muted-foreground dark:hover:text-destructive'
                    aria-label={`Delete ${category.name}`}
                  >
                    <Trash2 className='h-4 w-4' />
                  </button>
                </>
              )}
            </li>
          ))}

          {inactive.map((category) => (
            <li
              key={category.id}
              className='flex items-center gap-2 bg-muted/40 px-3 py-2 dark:bg-muted/20'
            >
              <span className='flex-1 text-sm text-muted-foreground line-through dark:text-muted-foreground'>
                {category.name}
              </span>
              <span className='rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground dark:border-border dark:text-muted-foreground'>
                Inactive
              </span>
              <button
                type='button'
                onClick={() => restoreMutation.mutate({ id: category.id })}
                disabled={restoreMutation.isPending}
                className='text-muted-foreground hover:text-primary dark:text-muted-foreground dark:hover:text-primary'
                aria-label={`Restore ${category.name}`}
              >
                <RotateCcw className='h-4 w-4' />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && removeMutation.mutate({ id: deleteTarget.id })}
        title='Delete Expense Category'
        message={
          deleteTarget && deleteTarget.usageCount > 0
            ? `"${deleteTarget.name}" is used by ${deleteTarget.usageCount} record(s). It will be deactivated (hidden from new entries) but historical records will be preserved.`
            : `Are you sure you want to delete "${deleteTarget?.name}"?`
        }
        variant={deleteTarget && deleteTarget.usageCount > 0 ? 'warning' : 'danger'}
        confirmButtonText={deleteTarget && deleteTarget.usageCount > 0 ? 'Deactivate' : 'Delete'}
        isLoading={removeMutation.isPending}
      />
    </div>
  );
}
