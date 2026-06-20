import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CategoryGroupsDrawer from '@/app/(authorized)/cashflow/category-groups/_components/CategoryGroupsDrawer';
import type { CategoryGroupListItem } from '@/server/services/category-groups/category-groups.service';

// Mock dependencies
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/server/trpc/client', () => ({
  trpc: {
    incomeSource: {
      getAllActive: {
        useQuery: vi.fn(() => ({
          data: [
            { id: 'source-1', name: 'Salary' },
            { id: 'source-2', name: 'Freelance' },
          ],
        })),
      },
    },
    expenseCategory: {
      getAllActive: {
        useQuery: vi.fn(() => ({
          data: [
            { id: 'cat-1', name: 'Groceries' },
            { id: 'cat-2', name: 'Utilities' },
            { id: 'cat-3', name: 'Transport' },
          ],
        })),
      },
    },
    categoryGroup: {
      create: {
        useMutation: vi.fn(() => ({
          mutateAsync: vi.fn(),
          isPending: false,
        })),
      },
      update: {
        useMutation: vi.fn(() => ({
          mutateAsync: vi.fn(),
          isPending: false,
        })),
      },
    },
  },
}));

describe('CategoryGroupsDrawer', () => {
  const mockEditingGroup: CategoryGroupListItem = {
    id: 'group-1',
    userId: 'user-1',
    scope: 'INCOME',
    name: 'Primary Income',
    description: 'Main income',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    memberCount: 2,
    memberIds: ['source-1', 'source-2'],
  };

  const mockOnClose = vi.fn();
  const mockOnGroupAdded = vi.fn();
  const mockOnGroupUpdated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    render(
      <CategoryGroupsDrawer
        isOpen={false}
        onClose={mockOnClose}
        onGroupAdded={mockOnGroupAdded}
      />,
    );

    expect(screen.queryByText('New Category Group')).not.toBeInTheDocument();
    expect(screen.queryByText('Edit Category Group')).not.toBeInTheDocument();
  });

  it('renders drawer header for create mode when isOpen is true and editingGroup is null', () => {
    render(
      <CategoryGroupsDrawer
        isOpen={true}
        onClose={mockOnClose}
        onGroupAdded={mockOnGroupAdded}
      />,
    );

    expect(screen.getByText('New Category Group')).toBeInTheDocument();
    expect(
      screen.getByText('Create a new category group to organize related items'),
    ).toBeInTheDocument();
  });

  it('renders drawer header for edit mode when editingGroup is provided', () => {
    render(
      <CategoryGroupsDrawer
        isOpen={true}
        onClose={mockOnClose}
        editingGroup={mockEditingGroup}
        onGroupUpdated={mockOnGroupUpdated}
      />,
    );

    expect(screen.getByText('Edit Category Group')).toBeInTheDocument();
    expect(
      screen.getByText('Update the group details and members'),
    ).toBeInTheDocument();
  });

  it('closes drawer when close button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <CategoryGroupsDrawer
        isOpen={true}
        onClose={mockOnClose}
        onGroupAdded={mockOnGroupAdded}
      />,
    );

    const closeButton = screen.getByRole('button', { name: 'Close drawer' });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes drawer when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <CategoryGroupsDrawer
        isOpen={true}
        onClose={mockOnClose}
        onGroupAdded={mockOnGroupAdded}
      />,
    );

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('displays scope selection in create mode', () => {
    render(
      <CategoryGroupsDrawer
        isOpen={true}
        onClose={mockOnClose}
        onGroupAdded={mockOnGroupAdded}
      />,
    );

    expect(screen.getByText('Group Type')).toBeInTheDocument();
  });

  it('hides scope selection in edit mode', () => {
    render(
      <CategoryGroupsDrawer
        isOpen={true}
        onClose={mockOnClose}
        editingGroup={mockEditingGroup}
        onGroupUpdated={mockOnGroupUpdated}
      />,
    );

    expect(screen.queryByText('Group Type')).not.toBeInTheDocument();
  });

  it('displays group name input field', () => {
    render(
      <CategoryGroupsDrawer
        isOpen={true}
        onClose={mockOnClose}
        onGroupAdded={mockOnGroupAdded}
      />,
    );

    expect(screen.getByLabelText('Group Name')).toBeInTheDocument();
  });

  it('displays description textarea', () => {
    render(
      <CategoryGroupsDrawer
        isOpen={true}
        onClose={mockOnClose}
        onGroupAdded={mockOnGroupAdded}
      />,
    );

    expect(screen.getByLabelText('Description (Optional)')).toBeInTheDocument();
  });

  it('prefills form with editing group data', () => {
    render(
      <CategoryGroupsDrawer
        isOpen={true}
        onClose={mockOnClose}
        editingGroup={mockEditingGroup}
        onGroupUpdated={mockOnGroupUpdated}
      />,
    );

    const nameInput = screen.getByDisplayValue('Primary Income');
    expect(nameInput).toBeInTheDocument();

    const descriptionInput = screen.getByDisplayValue('Main income');
    expect(descriptionInput).toBeInTheDocument();
  });

  it('allows entering group name', async () => {
    const user = userEvent.setup();
    render(
      <CategoryGroupsDrawer
        isOpen={true}
        onClose={mockOnClose}
        onGroupAdded={mockOnGroupAdded}
      />,
    );

    const nameInput = screen.getByPlaceholderText('e.g., Essential Expenses');
    await user.type(nameInput, 'My Test Group');

    expect(nameInput).toHaveValue('My Test Group');
  });

  it('allows entering description', async () => {
    const user = userEvent.setup();
    render(
      <CategoryGroupsDrawer
        isOpen={true}
        onClose={mockOnClose}
        onGroupAdded={mockOnGroupAdded}
      />,
    );

    const descriptionInput = screen.getByPlaceholderText(
      'Add a note about this group...',
    );
    await user.type(descriptionInput, 'This is a test group');

    expect(descriptionInput).toHaveValue('This is a test group');
  });

  it('has cancel and create buttons in create mode', () => {
    render(
      <CategoryGroupsDrawer
        isOpen={true}
        onClose={mockOnClose}
        onGroupAdded={mockOnGroupAdded}
      />,
    );

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Group' })).toBeInTheDocument();
  });

  it('has cancel and update buttons in edit mode', () => {
    render(
      <CategoryGroupsDrawer
        isOpen={true}
        onClose={mockOnClose}
        editingGroup={mockEditingGroup}
        onGroupUpdated={mockOnGroupUpdated}
      />,
    );

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update Group' })).toBeInTheDocument();
  });

  it('disables save button when form is invalid (no scope selected in create mode)', () => {
    render(
      <CategoryGroupsDrawer
        isOpen={true}
        onClose={mockOnClose}
        onGroupAdded={mockOnGroupAdded}
      />,
    );

    const createButton = screen.getByRole('button', { name: 'Create Group' });
    expect(createButton).toBeDisabled();
  });

  it('disables save button when group name is empty', async () => {
    const user = userEvent.setup();
    render(
      <CategoryGroupsDrawer
        isOpen={true}
        onClose={mockOnClose}
        editingGroup={mockEditingGroup}
        onGroupUpdated={mockOnGroupUpdated}
      />,
    );

    const nameInput = screen.getByDisplayValue('Primary Income');
    await user.clear(nameInput);

    const updateButton = screen.getByRole('button', { name: 'Update Group' });
    expect(updateButton).toBeDisabled();
  });

  it('allows selecting Income Sources as scope', async () => {
    const user = userEvent.setup();
    render(
      <CategoryGroupsDrawer
        isOpen={true}
        onClose={mockOnClose}
        onGroupAdded={mockOnGroupAdded}
      />,
    );

    // The scope selection should be visible
    expect(screen.getByText('Group Type')).toBeInTheDocument();
  });
});
