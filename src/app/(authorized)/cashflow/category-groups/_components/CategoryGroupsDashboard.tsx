'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { CategoryGroupListItem } from '@/server/services/category-groups/category-groups.service';

import CategoryGroupCard from './CategoryGroupCard';
import CategoryGroupsDrawer from './CategoryGroupsDrawer';

interface CategoryGroupsDashboardProps {
  initialGroups: CategoryGroupListItem[];
}

/**
 * Dashboard view for category groups
 * Displays groups organized by scope (Income vs Expense)
 * Provides action to open drawer for creating/editing groups
 */
export default function CategoryGroupsDashboard({
  initialGroups,
}: CategoryGroupsDashboardProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [groups, setGroups] = useState(initialGroups);
  const [editingGroup, setEditingGroup] =
    useState<CategoryGroupListItem | null>(null);

  // Split groups by scope
  const incomeGroups = groups.filter((g) => g.scope === 'INCOME');
  const expenseGroups = groups.filter((g) => g.scope === 'EXPENSE');

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
    setEditingGroup(null);
  };

  const handleOpenDrawer = () => {
    setEditingGroup(null);
    setIsDrawerOpen(true);
  };

  const handleEditGroup = (group: CategoryGroupListItem) => {
    setEditingGroup(group);
    setIsDrawerOpen(true);
  };

  const handleGroupAdded = (newGroup: CategoryGroupListItem) => {
    setGroups([newGroup, ...groups]);
    handleDrawerClose();
  };

  const handleGroupUpdated = (updatedGroup: CategoryGroupListItem) => {
    setGroups(groups.map((g) => (g.id === updatedGroup.id ? updatedGroup : g)));
    handleDrawerClose();
  };

  const handleGroupDeleted = (groupId: string) => {
    setGroups(groups.filter((g) => g.id !== groupId));
  };

  return (
    <>
      <div className='mb-6 flex justify-end'>
        <Button onClick={handleOpenDrawer} className='gap-2' size='lg'>
          <span>+</span> New Group
        </Button>
      </div>

      {/* Empty State */}
      {groups.length === 0 && (
        <div className='rounded-lg border border-dashed border-border bg-muted/50 p-12 text-center'>
          <h3 className='font-semibold text-foreground'>
            No category groups yet
          </h3>
          <p className='mt-1 text-sm text-muted-foreground'>
            Create your first category group to organize your income sources and
            expense categories.
          </p>
          <Button
            onClick={handleOpenDrawer}
            variant='default'
            className='mt-4 gap-2'
          >
            <span>+</span> Create Group
          </Button>
        </div>
      )}

      {/* Income Groups Section */}
      {incomeGroups.length > 0 && (
        <div className='mb-8'>
          <h2 className='mb-4 text-lg font-semibold text-foreground'>
            Income Groups
          </h2>
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {incomeGroups.map((group) => (
              <CategoryGroupCard
                key={group.id}
                group={group}
                onEdit={handleEditGroup}
                onDelete={handleGroupDeleted}
              />
            ))}
          </div>
        </div>
      )}

      {/* Expense Groups Section */}
      {expenseGroups.length > 0 && (
        <div className='mb-8'>
          <h2 className='mb-4 text-lg font-semibold text-foreground'>
            Expense Groups
          </h2>
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {expenseGroups.map((group) => (
              <CategoryGroupCard
                key={group.id}
                group={group}
                onEdit={handleEditGroup}
                onDelete={handleGroupDeleted}
              />
            ))}
          </div>
        </div>
      )}

      {/* Drawer for create/edit */}
      <CategoryGroupsDrawer
        isOpen={isDrawerOpen}
        onClose={handleDrawerClose}
        onGroupAdded={handleGroupAdded}
        onGroupUpdated={handleGroupUpdated}
        editingGroup={editingGroup}
      />
    </>
  );
}
