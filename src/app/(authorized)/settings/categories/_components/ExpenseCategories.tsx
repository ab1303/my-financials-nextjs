'use client';

import { useState } from 'react';
import { trpc } from '@/server/trpc/client';
import { toast } from 'sonner';
import { Pencil, Trash2, RotateCcw, Check, X, Plus, Tag, Search } from 'lucide-react';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';

type ExpenseCategoryRecord = {
  id: string;
  name: string;
  isActive: boolean;
  usageCount: number;
};

function LoadingSkeleton() {
  return (
    <ul className='divide-y divide-border rounded-lg border border-border'>
      {[1, 2, 3].map((i) => (
        <li key={i} className='flex items-center gap-3 px-4 py-3'>
          <div className='h-4 flex-1 animate-pulse rounded bg-muted' />
          <div className='h-7 w-7 animate-pulse rounded bg-muted' />
          <div className='h-7 w-7 animate-pulse rounded bg-muted' />
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ isFiltered, query }: { isFiltered: boolean; query: string }) {
  if (isFiltered) {
    return (
      <div className='flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-8 text-center'>
        <Search className='h-6 w-6 text-muted-foreground/40' aria-hidden='true' />
        <p className='text-sm text-muted-foreground'>
          No match for <span className='font-medium text-foreground'>"{query}"</span>
        </p>
        <p className='text-xs text-muted-foreground'>Press Enter or click Add to create it.</p>
      </div>
    );
  }
  return (
    <div className='flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-10 text-center'>
      <Tag className='h-8 w-8 text-muted-foreground/40' aria-hidden='true' />
      <div>
        <p className='text-sm font-medium text-foreground'>No expense categories yet</p>
        <p className='mt-0.5 text-xs text-muted-foreground'>Type a name above to add one.</p>
      </div>
    </div>
  );
}

export default function ExpenseCategories() {
  const utils = trpc.useUtils();
  const { data: categories = [], isLoading } = trpc.expenseCategory.getAll.useQuery();

  const [searchText, setSearchText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ExpenseCategoryRecord | null>(null);

  const createMutation = trpc.expenseCategory.create.useMutation({
    onSuccess: () => {
      void utils.expenseCategory.getAll.invalidate();
      toast.success('Expense category added');
      setSearchText('');
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

  const active = categories.filter((c) => c.isActive);
  const inactive = categories.filter((c) => !c.isActive);

  const query = searchText.trim();
  const filteredActive = query
    ? active.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    : active;
  const filteredInactive = query
    ? inactive.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    : inactive;

  const exactMatch = categories.some((c) => c.name.toLowerCase() === query.toLowerCase());
  const canCreate = query.length > 0 && !exactMatch && !createMutation.isPending;
  const isFiltered = query.length > 0;
  const hasNoResults = isFiltered && filteredActive.length === 0 && filteredInactive.length === 0;

  function handleCreate() {
    if (canCreate) createMutation.mutate({ name: query });
  }

  return (
    <div className='space-y-3'>
      {/* Search / Add input */}
      <div className='flex gap-2'>
        <label htmlFor='expense-category-input' className='sr-only'>
          Search or add expense category
        </label>
        <div className='relative flex-1'>
          <Search
            className='pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground'
            aria-hidden='true'
          />
          <input
            id='expense-category-input'
            name='expense-category-input'
            type='text'
            autoComplete='off'
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') setSearchText('');
            }}
            placeholder='Search or add new…'
            className='w-full rounded-md border border-input bg-background py-2 pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-input dark:bg-background dark:text-foreground'
          />
          {searchText && (
            <button
              type='button'
              onClick={() => setSearchText('')}
              className='absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              aria-label='Clear search'
            >
              <X className='h-3.5 w-3.5' aria-hidden='true' />
            </button>
          )}
        </div>
        <button
          type='button'
          onClick={handleCreate}
          disabled={!canCreate}
          className='inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40'
        >
          <Plus className='h-4 w-4' aria-hidden='true' />
          {createMutation.isPending ? 'Adding…' : 'Add'}
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : active.length === 0 && inactive.length === 0 ? (
        <EmptyState isFiltered={false} query={query} />
      ) : hasNoResults ? (
        <EmptyState isFiltered query={query} />
      ) : (
        <ul className='max-h-[420px] divide-y divide-border overflow-y-auto rounded-lg border border-border'>
          {filteredActive.map((category) => (
            <li
              key={category.id}
              className='group flex items-center gap-2 px-4 py-3 transition-colors hover:bg-muted/30'
            >
              {editingId === category.id ? (
                <>
                  <label htmlFor={`edit-expense-${category.id}`} className='sr-only'>
                    Edit name
                  </label>
                  <input
                    id={`edit-expense-${category.id}`}
                    type='text'
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && editName.trim()) {
                        updateMutation.mutate({ id: category.id, name: editName.trim() });
                      }
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    autoFocus
                    className='flex-1 rounded border border-input bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-input dark:bg-background dark:text-foreground'
                  />
                  <button
                    type='button'
                    onClick={() =>
                      editName.trim() &&
                      updateMutation.mutate({ id: category.id, name: editName.trim() })
                    }
                    disabled={!editName.trim() || updateMutation.isPending}
                    className='rounded p-1.5 text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50'
                    aria-label='Save'
                  >
                    <Check className='h-4 w-4' aria-hidden='true' />
                  </button>
                  <button
                    type='button'
                    onClick={() => setEditingId(null)}
                    className='rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                    aria-label='Cancel edit'
                  >
                    <X className='h-4 w-4' aria-hidden='true' />
                  </button>
                </>
              ) : (
                <>
                  <span className='min-w-0 flex-1 truncate text-sm text-foreground'>
                    {category.name}
                  </span>
                  <div className='flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100'>
                    <button
                      type='button'
                      onClick={() => {
                        setEditingId(category.id);
                        setEditName(category.name);
                      }}
                      className='rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                      aria-label={`Edit ${category.name}`}
                    >
                      <Pencil className='h-3.5 w-3.5' aria-hidden='true' />
                    </button>
                    <button
                      type='button'
                      onClick={() => setDeleteTarget(category)}
                      className='rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                      aria-label={`Delete ${category.name}`}
                    >
                      <Trash2 className='h-3.5 w-3.5' aria-hidden='true' />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}

          {filteredInactive.map((category) => (
            <li
              key={category.id}
              className='group flex items-center gap-3 bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/40'
            >
              <span className='min-w-0 flex-1 truncate text-sm text-muted-foreground line-through'>
                {category.name}
              </span>
              <span className='shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'>
                Inactive
              </span>
              <button
                type='button'
                onClick={() => restoreMutation.mutate({ id: category.id })}
                disabled={restoreMutation.isPending}
                className='shrink-0 rounded p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-primary/10 hover:text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 group-hover:opacity-100'
                aria-label={`Restore ${category.name}`}
              >
                <RotateCcw className='h-3.5 w-3.5' aria-hidden='true' />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Count */}
      {!isLoading && (active.length > 0 || inactive.length > 0) && (
        <p className='text-xs text-muted-foreground' aria-live='polite'>
          {isFiltered
            ? `${filteredActive.length + filteredInactive.length} of ${categories.length} shown`
            : `${active.length} active${inactive.length > 0 ? `, ${inactive.length} inactive` : ''}`}
        </p>
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
