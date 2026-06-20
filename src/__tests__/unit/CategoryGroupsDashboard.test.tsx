import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CategoryGroupsDashboard from '@/app/(authorized)/cashflow/category-groups/_components/CategoryGroupsDashboard';
import type { CategoryGroupListItem } from '@/server/services/category-groups/category-groups.service';

// Mock the child components to isolate dashboard tests
vi.mock('@/app/(authorized)/cashflow/category-groups/_components/CategoryGroupCard', () => ({
  default: ({ group, onEdit, onDelete }: {
    group: CategoryGroupListItem;
    onEdit: (group: CategoryGroupListItem) => void;
    onDelete: (groupId: string) => void;
  }) => (
    <div data-testid={`card-${group.id}`}>
      <h3>{group.name}</h3>
      <p data-testid={`member-count-${group.id}`}>{group.memberCount} members</p>
      <button onClick={() => onEdit(group)} data-testid={`edit-${group.id}`}>Edit</button>
      <button onClick={() => onDelete(group.id)} data-testid={`delete-${group.id}`}>Delete</button>
    </div>
  ),
}));

vi.mock('@/app/(authorized)/cashflow/category-groups/_components/CategoryGroupsDrawer', () => ({
  default: ({ isOpen, editingGroup, onClose, onGroupAdded, onGroupUpdated }: {
    isOpen: boolean;
    editingGroup?: CategoryGroupListItem | null;
    onClose: () => void;
    onGroupAdded?: (group: CategoryGroupListItem) => void;
    onGroupUpdated?: (group: CategoryGroupListItem) => void;
  }) => (
    <>
      {isOpen && (
        <div data-testid="drawer-open">
          <button onClick={onClose} data-testid="drawer-close">Close</button>
        </div>
      )}
    </>
  ),
}));

describe('CategoryGroupsDashboard', () => {
  const mockIncomeGroup: CategoryGroupListItem = {
    id: 'income-1',
    userId: 'user-1',
    scope: 'INCOME',
    name: 'Primary Income',
    description: 'Main income sources',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    memberCount: 2,
    memberIds: ['source-1', 'source-2'],
  };

  const mockExpenseGroup: CategoryGroupListItem = {
    id: 'expense-1',
    userId: 'user-1',
    scope: 'EXPENSE',
    name: 'Recurring Expenses',
    description: 'Monthly expenses',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    memberCount: 5,
    memberIds: ['cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with empty state when no groups exist', () => {
    render(<CategoryGroupsDashboard initialGroups={[]} />);

    expect(screen.getByText('No category groups yet')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Create your first category group to organize your income sources and expense categories/,
      ),
    ).toBeInTheDocument();
  });

  it('shows both empty state and create button actions', () => {
    render(<CategoryGroupsDashboard initialGroups={[]} />);

    // Check for both the header action button and empty state button
    const createButtons = screen.getAllByRole('button', { name: /\+ New Group/i });
    expect(createButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders Income Groups section with cards when income groups exist', () => {
    render(
      <CategoryGroupsDashboard
        initialGroups={[mockIncomeGroup]}
      />,
    );

    expect(screen.getByText('Income Groups')).toBeInTheDocument();
    expect(screen.getByText('Primary Income')).toBeInTheDocument();
    expect(screen.getByTestId('member-count-income-1')).toHaveTextContent('2 members');
  });

  it('renders Expense Groups section with cards when expense groups exist', () => {
    render(
      <CategoryGroupsDashboard
        initialGroups={[mockExpenseGroup]}
      />,
    );

    expect(screen.getByText('Expense Groups')).toBeInTheDocument();
    expect(screen.getByText('Recurring Expenses')).toBeInTheDocument();
    expect(screen.getByTestId('member-count-expense-1')).toHaveTextContent(
      '5 members',
    );
  });

  it('renders both sections when both income and expense groups exist', () => {
    render(
      <CategoryGroupsDashboard
        initialGroups={[mockIncomeGroup, mockExpenseGroup]}
      />,
    );

    expect(screen.getByText('Income Groups')).toBeInTheDocument();
    expect(screen.getByText('Expense Groups')).toBeInTheDocument();
    expect(screen.getByText('Primary Income')).toBeInTheDocument();
    expect(screen.getByText('Recurring Expenses')).toBeInTheDocument();
  });

  it('opens drawer when + New Group button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <CategoryGroupsDashboard
        initialGroups={[mockIncomeGroup]}
      />,
    );

    const newGroupButton = screen.getByRole('button', { name: /\+ New Group/i });
    await user.click(newGroupButton);

    expect(screen.getByTestId('drawer-open')).toBeInTheDocument();
  });

  it('closes drawer when onClose is called', async () => {
    const user = userEvent.setup();
    render(
      <CategoryGroupsDashboard
        initialGroups={[mockIncomeGroup]}
      />,
    );

    const newGroupButton = screen.getByRole('button', { name: /\+ New Group/i });
    await user.click(newGroupButton);

    expect(screen.getByTestId('drawer-open')).toBeInTheDocument();

    const closeButton = screen.getByTestId('drawer-close');
    await user.click(closeButton);

    expect(screen.queryByTestId('drawer-open')).not.toBeInTheDocument();
  });

  it('handles group deletion by removing it from the list', async () => {
    render(
      <CategoryGroupsDashboard
        initialGroups={[mockIncomeGroup, mockExpenseGroup]}
      />,
    );

    expect(screen.getByText('Primary Income')).toBeInTheDocument();

    const deleteButton = screen.getByTestId('delete-income-1');
    await userEvent.setup().click(deleteButton);

    // The group should be removed from the list
    expect(screen.queryByText('Primary Income')).not.toBeInTheDocument();
    expect(screen.getByText('Recurring Expenses')).toBeInTheDocument();
  });

  it('does not show Income Groups section when no income groups exist', () => {
    render(
      <CategoryGroupsDashboard
        initialGroups={[mockExpenseGroup]}
      />,
    );

    expect(screen.queryByText('Income Groups')).not.toBeInTheDocument();
    expect(screen.getByText('Expense Groups')).toBeInTheDocument();
  });

  it('does not show Expense Groups section when no expense groups exist', () => {
    render(
      <CategoryGroupsDashboard
        initialGroups={[mockIncomeGroup]}
      />,
    );

    expect(screen.getByText('Income Groups')).toBeInTheDocument();
    expect(screen.queryByText('Expense Groups')).not.toBeInTheDocument();
  });
});
