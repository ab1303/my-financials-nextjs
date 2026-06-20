'use client';

import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { SelectWrapper } from '@/components/ui/Select';
import { TextInput } from '@/components/ui/TextInput';
import type { CategoryGroupListItem } from '@/server/services/category-groups/category-groups.service';
import { trpc } from '@/server/trpc/client';

interface CategoryGroupsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupAdded?: (group: CategoryGroupListItem) => void;
  onGroupUpdated?: (group: CategoryGroupListItem) => void;
  editingGroup?: CategoryGroupListItem | null;
}

interface FormData {
  scope: 'INCOME' | 'EXPENSE' | null;
  name: string;
  description: string;
  memberIds: string[];
}

type SelectOption = {
  value: string;
  label: string;
};

/**
 * Drawer component for creating/editing category groups
 * Includes scope selection, group name, and member selection
 */
export default function CategoryGroupsDrawer({
  isOpen,
  onClose,
  onGroupAdded,
  onGroupUpdated,
  editingGroup,
}: CategoryGroupsDrawerProps) {
  const [formData, setFormData] = useState<FormData>({
    scope: null,
    name: '',
    description: '',
    memberIds: [],
  });

  const [isSaving, setIsSaving] = useState(false);

  // Reset form when drawer closes or editing group changes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        scope: null,
        name: '',
        description: '',
        memberIds: [],
      });
      return;
    }

    if (editingGroup) {
      setFormData({
        scope: editingGroup.scope,
        name: editingGroup.name,
        description: editingGroup.description || '',
        memberIds: [], // Will be loaded from members
      });
    }
  }, [isOpen, editingGroup]);

  // Fetch income sources and expense categories
  const { data: incomeSourcesData } = trpc.incomeSource.getAllActive.useQuery(
    undefined,
    { enabled: formData.scope === 'INCOME' || !formData.scope },
  );

  const { data: expenseCategoriesData } = trpc.expenseCategory.getAllActive.useQuery(
    undefined,
    { enabled: formData.scope === 'EXPENSE' || !formData.scope },
  );

  // tRPC mutations
  const createMutation = trpc.categoryGroup.create.useMutation();
  const updateMutation = trpc.categoryGroup.update.useMutation();

  const handleSave = async () => {
    if (!formData.scope) {
      toast.error('Please select a scope (Income or Expense)');
      return;
    }

    if (!formData.name.trim()) {
      toast.error('Please enter a group name');
      return;
    }

    if (formData.memberIds.length === 0) {
      toast.error('Please select at least one member');
      return;
    }

    setIsSaving(true);

    try {
      if (editingGroup) {
        // Update mode
        const result = await updateMutation.mutateAsync({
          groupId: editingGroup.id,
          name: formData.name,
          description: formData.description || null,
          memberIds: formData.memberIds,
        });
        toast.success('Category group updated successfully');
        onGroupUpdated?.(result);
      } else {
        // Create mode
        const result = await createMutation.mutateAsync({
          scope: formData.scope,
          name: formData.name,
          description: formData.description || null,
          memberIds: formData.memberIds,
        });
        toast.success('Category group created successfully');
        onGroupAdded?.(result);
      }
      onClose();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to save category group';
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleScopeChange = (
    option: { value: 'INCOME' | 'EXPENSE'; label: string } | null,
  ) => {
    setFormData({
      ...formData,
      scope: option?.value || null,
      memberIds: [], // Reset members when scope changes
    });
  };

  // Prepare options based on scope
  const memberOptions: SelectOption[] =
    formData.scope === 'INCOME'
      ? (incomeSourcesData ?? []).map((source) => ({
          value: source.id,
          label: source.name,
        }))
      : (expenseCategoriesData ?? []).map((category) => ({
          value: category.id,
          label: category.name,
        }));

  const scopeOptions = [
    { value: 'INCOME' as const, label: 'Income Sources' },
    { value: 'EXPENSE' as const, label: 'Expense Categories' },
  ];

  const selectedMembers = memberOptions.filter((opt) =>
    formData.memberIds.includes(opt.value)
  );

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      {/* Drawer Content */}
      <div className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-background shadow-2xl">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {editingGroup ? 'Edit Category Group' : 'New Category Group'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {editingGroup
                ? 'Update the group details and members'
                : 'Create a new category group to organize related items'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Scope Selection - only show in create mode */}
            {!editingGroup && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Group Type
                </label>
                <SelectWrapper
                  options={scopeOptions}
                  value={
                    formData.scope
                      ? scopeOptions.find((opt) => opt.value === formData.scope)
                      : null
                  }
                  onChange={handleScopeChange}
                  isClearable={false}
                  isSearchable={false}
                  placeholder="Select Income or Expense..."
                />
              </div>
            )}

            {/* Group Name */}
            <div>
              <label htmlFor="groupName" className="block text-sm font-medium text-foreground mb-2">
                Group Name
              </label>
              <TextInput
                id="groupName"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Essential Expenses"
                disabled={isSaving}
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-foreground mb-2">
                Description (Optional)
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Add a note about this group..."
                disabled={isSaving}
                className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </div>

            {/* Member Selection - only show if scope is selected */}
            {formData.scope && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {formData.scope === 'INCOME' ? 'Income Sources' : 'Expense Categories'}
                </label>
                <SelectWrapper<SelectOption, true>
                  isMulti
                  options={memberOptions}
                  value={selectedMembers}
                  onChange={(options) => {
                    const newMemberIds = options.map((opt) => opt.value);
                    setFormData({ ...formData, memberIds: newMemberIds });
                  }}
                  placeholder={`Select ${formData.scope === 'INCOME' ? 'income sources' : 'expense categories'}...`}
                  isDisabled={isSaving}
                />
              </div>
            )}
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="border-t border-border bg-muted/50 px-6 py-4 flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !formData.scope || !formData.name.trim() || formData.memberIds.length === 0}
          >
            {isSaving ? 'Saving...' : editingGroup ? 'Update Group' : 'Create Group'}
          </Button>
        </div>
      </div>

      {/* Overlay click to close */}
      <div
        className="absolute inset-0 z-[-1]"
        onClick={onClose}
        aria-hidden="true"
      />
    </div>,
    document.body,
  );
}
