'use client';

import { Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import type { CategoryGroupListItem } from '@/server/services/category-groups/category-groups.service';
import { trpc } from '@/server/trpc/client';

interface CategoryGroupCardProps {
  group: CategoryGroupListItem;
  onEdit: (group: CategoryGroupListItem) => void;
  onDelete: (groupId: string) => void;
}

/**
 * Card component displaying a category group
 * Shows group name, member count, and action buttons for edit/delete
 */
export default function CategoryGroupCard({
  group,
  onEdit,
  onDelete,
}: CategoryGroupCardProps) {
  const deleteMutation = trpc.categoryGroup.delete.useMutation();

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${group.name}"?`)) {
      return;
    }

    try {
      await deleteMutation.mutateAsync({ groupId: group.id });
      toast.success('Category group deleted successfully');
      onDelete(group.id);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to delete category group';
      toast.error(errorMessage);
    }
  };

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="mb-3 flex-1">
        <h3 className="font-semibold text-foreground">{group.name}</h3>
        <p className="text-sm text-muted-foreground">
          {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
        </p>
        {group.description && (
          <p className="mt-2 text-sm text-foreground/70">{group.description}</p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => onEdit(group)}
          disabled={deleteMutation.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-950 dark:hover:bg-slate-900"
        >
          <Edit2 className="h-4 w-4 text-muted-foreground" />
          Edit
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-500/15 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-300 dark:hover:bg-red-400/15 dark:hover:text-red-200"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>
    </div>
  );
}
