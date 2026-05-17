'use client';

import { useState } from 'react';
import { trpc } from '@/server/trpc/client';
import { toast } from 'sonner';
import { Pencil, Trash2, RotateCcw, Check, X, Plus } from 'lucide-react';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';

type IncomeSourceRecord = {
  id: string;
  name: string;
  isActive: boolean;
  usageCount: number;
};

export default function IncomeSources() {
  const utils = trpc.useUtils();
  const { data: sources = [], isLoading } = trpc.incomeSource.getAll.useQuery();

  const [addName, setAddName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<IncomeSourceRecord | null>(null);

  const createMutation = trpc.incomeSource.create.useMutation({
    onSuccess: () => {
      void utils.incomeSource.getAll.invalidate();
      toast.success('Income source added');
      setAddName('');
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = trpc.incomeSource.update.useMutation({
    onSuccess: () => {
      void utils.incomeSource.getAll.invalidate();
      toast.success('Income source updated');
      setEditingId(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const removeMutation = trpc.incomeSource.remove.useMutation({
    onSuccess: (result) => {
      void utils.incomeSource.getAll.invalidate();
      toast.success(
        result.softDeleted
          ? 'Income source deactivated (used by existing records)'
          : 'Income source deleted',
      );
      setDeleteTarget(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const restoreMutation = trpc.incomeSource.restore.useMutation({
    onSuccess: () => {
      void utils.incomeSource.getAll.invalidate();
      toast.success('Income source restored');
    },
    onError: (error) => toast.error(error.message),
  });

  const active = sources.filter((source) => source.isActive);
  const inactive = sources.filter((source) => !source.isActive);

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
          placeholder='New income source name…'
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
          No income sources yet. Add one above.
        </p>
      ) : (
        <ul className='divide-y divide-border rounded-md border border-border dark:divide-border dark:border-border'>
          {active.map((source) => (
            <li key={source.id} className='flex items-center gap-2 px-3 py-2'>
              {editingId === source.id ? (
                <>
                  <input
                    type='text'
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && editName.trim()) {
                        updateMutation.mutate({ id: source.id, name: editName.trim() });
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
                    onClick={() => editName.trim() && updateMutation.mutate({ id: source.id, name: editName.trim() })}
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
                    {source.name}
                  </span>
                  <button
                    type='button'
                    onClick={() => {
                      setEditingId(source.id);
                      setEditName(source.name);
                    }}
                    className='text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground'
                    aria-label={`Edit ${source.name}`}
                  >
                    <Pencil className='h-4 w-4' />
                  </button>
                  <button
                    type='button'
                    onClick={() => setDeleteTarget(source)}
                    className='text-muted-foreground hover:text-destructive dark:text-muted-foreground dark:hover:text-destructive'
                    aria-label={`Delete ${source.name}`}
                  >
                    <Trash2 className='h-4 w-4' />
                  </button>
                </>
              )}
            </li>
          ))}

          {inactive.map((source) => (
            <li
              key={source.id}
              className='flex items-center gap-2 bg-muted/40 px-3 py-2 dark:bg-muted/20'
            >
              <span className='flex-1 text-sm text-muted-foreground line-through dark:text-muted-foreground'>
                {source.name}
              </span>
              <span className='rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground dark:border-border dark:text-muted-foreground'>
                Inactive
              </span>
              <button
                type='button'
                onClick={() => restoreMutation.mutate({ id: source.id })}
                disabled={restoreMutation.isPending}
                className='text-muted-foreground hover:text-primary dark:text-muted-foreground dark:hover:text-primary'
                aria-label={`Restore ${source.name}`}
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
        title='Delete Income Source'
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
