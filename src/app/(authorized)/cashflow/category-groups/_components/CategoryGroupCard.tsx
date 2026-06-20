'use client';

import { Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
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
      <div className="flex gap-2 border-t border-border pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(group)}
          className="flex-1 gap-2"
          disabled={deleteMutation.isPending}
        >
          <Edit2 className="h-4 w-4" />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="flex-1 gap-2 text-destructive hover:text-destructive"
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>
    </div>
  );
}
