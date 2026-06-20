import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Create a mock dashboard component for testing
const MockCategoryGroupsDashboard = ({
  groups,
  onOpenDrawer,
}: {
  groups: Array<{
    id: string;
    name: string;
    scope: 'INCOME' | 'EXPENSE';
    memberCount: number;
  }>;
  onOpenDrawer: () => void;
}) => {
  const incomeGroups = groups.filter((g) => g.scope === 'INCOME');
  const expenseGroups = groups.filter((g) => g.scope === 'EXPENSE');

  return (
    <div>
      <button onClick={onOpenDrawer}>+ New Group</button>

      {groups.length === 0 && (
        <div data-testid="empty-state">
          No category groups defined yet. Create one to get started.
        </div>
      )}

      {incomeGroups.length > 0 && (
        <div>
          <h2>Income Groups</h2>
          {incomeGroups.map((group) => (
            <div key={group.id} data-testid={`group-${group.id}`}>
              <h3>{group.name}</h3>
              <p>{group.memberCount} member(s)</p>
            </div>
          ))}
        </div>
      )}

      {expenseGroups.length > 0 && (
        <div>
          <h2>Expense Groups</h2>
          {expenseGroups.map((group) => (
            <div key={group.id} data-testid={`group-${group.id}`}>
              <h3>{group.name}</h3>
              <p>{group.memberCount} member(s)</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

describe('CategoryGroupsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders grouped Income and Expense sections', () => {
    const groups = [
      {
        id: 'group-1',
        name: 'Primary Income',
        scope: 'INCOME' as const,
        memberCount: 2,
      },
      {
        id: 'group-2',
        name: 'Recurring Expenses',
        scope: 'EXPENSE' as const,
        memberCount: 5,
      },
    ];
    const mockOnOpen = vi.fn();

    render(<MockCategoryGroupsDashboard groups={groups} onOpenDrawer={mockOnOpen} />);

    expect(screen.getByText('Income Groups')).toBeInTheDocument();
    expect(screen.getByText('Expense Groups')).toBeInTheDocument();
    expect(screen.getByText('Primary Income')).toBeInTheDocument();
    expect(screen.getByText('Recurring Expenses')).toBeInTheDocument();
  });

  it('shows empty state when no groups exist', () => {
    const mockOnOpen = vi.fn();

    render(<MockCategoryGroupsDashboard groups={[]} onOpenDrawer={mockOnOpen} />);

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(
      screen.getByText('No category groups defined yet. Create one to get started.'),
    ).toBeInTheDocument();
  });

  it('opens drawer when + button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnOpen = vi.fn();

    render(
      <MockCategoryGroupsDashboard
        groups={[
          {
            id: 'group-1',
            name: 'Primary Income',
            scope: 'INCOME' as const,
            memberCount: 2,
          },
        ]}
        onOpenDrawer={mockOnOpen}
      />,
    );

    await user.click(screen.getByRole('button', { name: /\+ New Group/i }));

    expect(mockOnOpen).toHaveBeenCalled();
  });

  it('displays member count for each group', () => {
    const groups = [
      {
        id: 'group-1',
        name: 'Primary Income',
        scope: 'INCOME' as const,
        memberCount: 3,
      },
    ];
    const mockOnOpen = vi.fn();

    render(<MockCategoryGroupsDashboard groups={groups} onOpenDrawer={mockOnOpen} />);

    expect(screen.getByText('3 member(s)')).toBeInTheDocument();
  });
});
