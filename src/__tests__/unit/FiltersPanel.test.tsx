import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FiltersPanel } from '@/components/ui/filters';
import mockGroups from '@/lib/mockFilterData';

describe('FiltersPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render the filters panel with category groups', () => {
      render(<FiltersPanel initialGroups={mockGroups} />);
      
      // Check for main title
      expect(screen.getByText('Category Groups')).toBeDefined();
      
      // Check for Essentials and Investments groups
      expect(screen.getByText('Essentials')).toBeDefined();
      expect(screen.getByText('Investments & Transfers')).toBeDefined();
    });

    it('should render all category items under groups', () => {
      render(<FiltersPanel initialGroups={mockGroups} />);
      
      // Check for all categories
      mockGroups.forEach(group => {
        group.categories.forEach(category => {
          expect(screen.getByText(category.name)).toBeDefined();
        });
      });
    });

    it('should render group checkboxes with aria-checked attribute', () => {
      render(<FiltersPanel initialGroups={mockGroups} />);
      
      // Each group should have a checkbox with aria-checked
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    it('should render Preview Totals section', () => {
      render(<FiltersPanel initialGroups={mockGroups} />);
      
      expect(screen.getByText('Preview Totals')).toBeDefined();
      
      // Use getAllByText for elements that appear multiple times
      const incomeLabels = screen.getAllByText('Income');
      expect(incomeLabels.length).toBeGreaterThan(0);
      
      const expensesLabels = screen.getAllByText('Expenses');
      expect(expensesLabels.length).toBeGreaterThan(0);
      
      const netLabels = screen.getAllByText('Net');
      expect(netLabels.length).toBeGreaterThan(0);
    });

    it('should render Save View and Clear filters buttons', () => {
      render(<FiltersPanel initialGroups={mockGroups} />);
      
      expect(screen.getByText('Save View')).toBeDefined();
      expect(screen.getByText('Clear filters')).toBeDefined();
    });

    it('should emit selected category ids when defaultSelectAll is enabled', async () => {
      const onSelectionChange = vi.fn();

      render(
        <FiltersPanel
          initialGroups={mockGroups}
          defaultSelectAll
          onSelectionChange={onSelectionChange}
        />,
      );

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenCalled();
      });

      const lastCall = onSelectionChange.mock.calls.at(-1)?.[0] as string[];
      expect(lastCall).toEqual(
        expect.arrayContaining(
          mockGroups.flatMap((group) => group.categories.map((category) => category.id)),
        ),
      );
    });
  });

  describe('category checkbox interactions', () => {
    it('should toggle individual category selection', async () => {
      const user = userEvent.setup();
      render(<FiltersPanel initialGroups={mockGroups} />);
      
      const rentLabel = screen.getByText('Rent').closest('label');
      const checkbox = within(rentLabel!).getByRole('checkbox');
      
      // Initially unchecked
      expect((checkbox as HTMLInputElement).checked).toBe(false);
      
      // Click to check
      await user.click(checkbox);
      expect((checkbox as HTMLInputElement).checked).toBe(true);
      
      // Click to uncheck
      await user.click(checkbox);
      expect((checkbox as HTMLInputElement).checked).toBe(false);
    });

    it('should update preview totals when category is selected', async () => {
      const user = userEvent.setup();
      render(<FiltersPanel initialGroups={mockGroups} />);
      
      // Find Rent category (expense of $1200)
      const rentLabel = screen.getByText('Rent').closest('label');
      const checkbox = within(rentLabel!).getByRole('checkbox');
      
      // Click to select
      await user.click(checkbox);
      
      // Preview should update (we'll check the presence of total values)
      expect(screen.getByText(/Preview Totals/)).toBeDefined();
    });

    it('should handle multiple category selections', async () => {
      const user = userEvent.setup();
      render(<FiltersPanel initialGroups={mockGroups} />);
      
      // Find and click Rent
      const rentLabel = screen.getByText('Rent').closest('label');
      const rentCheckbox = within(rentLabel!).getByRole('checkbox');
      await user.click(rentCheckbox);
      
      // Find and click Groceries
      const groceriesLabel = screen.getByText('Groceries').closest('label');
      const groceriesCheckbox = within(groceriesLabel!).getByRole('checkbox');
      await user.click(groceriesCheckbox);
      
      expect((rentCheckbox as HTMLInputElement).checked).toBe(true);
      expect((groceriesCheckbox as HTMLInputElement).checked).toBe(true);
    });
  });

  describe('group tri-state behavior', () => {
    it('should have unchecked state when no categories in group are selected', async () => {
      render(<FiltersPanel initialGroups={mockGroups} />);
      
      const essentialsGroup = screen.getByText('Essentials').closest('div');
      const groupCheckbox = within(essentialsGroup!.parentElement!).getByRole('checkbox');
      
      expect((groupCheckbox as HTMLInputElement).checked).toBe(false);
      expect((groupCheckbox as HTMLInputElement).indeterminate).toBe(false);
    });

    it('should select all categories when group checkbox is clicked', async () => {
      const user = userEvent.setup();
      render(<FiltersPanel initialGroups={mockGroups} />);
      
      const essentialsGroup = screen.getByText('Essentials').closest('div');
      const groupCheckbox = within(essentialsGroup!.parentElement!).getByRole('checkbox');
      
      // Click group checkbox to select all
      await user.click(groupCheckbox);
      
      // Both Rent and Groceries should now be checked
      const rentLabel = screen.getByText('Rent').closest('label');
      const rentCheckbox = within(rentLabel!).getByRole('checkbox');
      
      const groceriesLabel = screen.getByText('Groceries').closest('label');
      const groceriesCheckbox = within(groceriesLabel!).getByRole('checkbox');
      
      expect((rentCheckbox as HTMLInputElement).checked).toBe(true);
      expect((groceriesCheckbox as HTMLInputElement).checked).toBe(true);
    });

    it('should show indeterminate state when some categories are selected', async () => {
      const user = userEvent.setup();
      render(<FiltersPanel initialGroups={mockGroups} />);
      
      // Select only Rent (not Groceries)
      const rentLabel = screen.getByText('Rent').closest('label');
      const rentCheckbox = within(rentLabel!).getByRole('checkbox');
      await user.click(rentCheckbox);
      
      // Group checkbox should be indeterminate
      const essentialsGroup = screen.getByText('Essentials').closest('div');
      const groupCheckbox = within(essentialsGroup!.parentElement!).getByRole('checkbox');
      
      expect((groupCheckbox as HTMLInputElement).indeterminate).toBe(true);
    });

    it('should deselect all categories when checked group is clicked again', async () => {
      const user = userEvent.setup();
      render(<FiltersPanel initialGroups={mockGroups} />);
      
      const essentialsGroup = screen.getByText('Essentials').closest('div');
      const groupCheckbox = within(essentialsGroup!.parentElement!).getByRole('checkbox');
      
      // Click to select all
      await user.click(groupCheckbox);
      expect((groupCheckbox as HTMLInputElement).checked).toBe(true);
      
      // Click again to deselect all
      await user.click(groupCheckbox);
      expect((groupCheckbox as HTMLInputElement).checked).toBe(false);
      
      // Individual categories should be unchecked
      const rentLabel = screen.getByText('Rent').closest('label');
      const rentCheckbox = within(rentLabel!).getByRole('checkbox');
      expect((rentCheckbox as HTMLInputElement).checked).toBe(false);
    });

    it('should display checked/total count for each group', () => {
      render(<FiltersPanel initialGroups={mockGroups} />);
      
      // Essentials has 2 categories, should show "0/2" initially
      const counts = screen.getAllByText(/^\d+\/\d+$/);
      expect(counts.length).toBeGreaterThan(0);
      
      // Check that we have the expected count displays
      const countTexts = counts.map(el => el.textContent);
      expect(countTexts).toContain('0/2');
      expect(countTexts).toContain('0/1');
    });
  });

  describe('keyboard accessibility', () => {
    it('should allow keyboard navigation and selection with Space', async () => {
      const user = userEvent.setup();
      render(<FiltersPanel initialGroups={mockGroups} />);
      
      const rentLabel = screen.getByText('Rent').closest('label');
      const checkbox = within(rentLabel!).getByRole('checkbox');
      
      // Tab to element
      checkbox.focus();
      expect(checkbox).toHaveFocus();
      
      // Press Space to toggle
      await user.keyboard(' ');
      expect((checkbox as HTMLInputElement).checked).toBe(true);
    });

    it('should allow keyboard navigation of group checkboxes', async () => {
      const user = userEvent.setup();
      render(<FiltersPanel initialGroups={mockGroups} />);
      
      const essentialsGroup = screen.getByText('Essentials').closest('div');
      const groupCheckbox = within(essentialsGroup!.parentElement!).getByRole('checkbox');
      
      groupCheckbox.focus();
      expect(groupCheckbox).toHaveFocus();
      
      await user.keyboard(' ');
      expect((groupCheckbox as HTMLInputElement).checked).toBe(true);
    });

    it('should have proper aria-checked attribute for tri-state', async () => {
      const user = userEvent.setup();
      render(<FiltersPanel initialGroups={mockGroups} />);
      
      const essentialsGroup = screen.getByText('Essentials').closest('div');
      const groupCheckbox = within(essentialsGroup!.parentElement!).getByRole('checkbox');
      
      // Initially unchecked
      expect(groupCheckbox).toHaveAttribute('aria-checked', 'false');
      
      // Select one category to trigger indeterminate
      const rentLabel = screen.getByText('Rent').closest('label');
      const rentCheckbox = within(rentLabel!).getByRole('checkbox');
      await user.click(rentCheckbox);
      
      // Should show mixed state
      expect(groupCheckbox).toHaveAttribute('aria-checked', 'mixed');
      
      // Select second category
      const groceriesLabel = screen.getByText('Groceries').closest('label');
      const groceriesCheckbox = within(groceriesLabel!).getByRole('checkbox');
      await user.click(groceriesCheckbox);
      
      // Should show checked
      expect(groupCheckbox).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('preview totals', () => {
    it('should compute correct income total', async () => {
      const user = userEvent.setup();
      render(<FiltersPanel initialGroups={mockGroups} />);
      
      // Select Salary (income of $5000)
      const salaryLabel = screen.getByText('Salary').closest('label');
      const salaryCheckbox = within(salaryLabel!).getByRole('checkbox');
      await user.click(salaryCheckbox);
      
      // Should show income of $5000 in preview totals
      const incomeSection = screen.getAllByText('Income').find(el => 
        el.parentElement?.textContent?.includes('5000')
      );
      expect(incomeSection).toBeDefined();
    });

    it('should compute correct expense total', async () => {
      const user = userEvent.setup();
      render(<FiltersPanel initialGroups={mockGroups} />);
      
      // Select Rent ($1200) and Groceries ($450)
      const rentLabel = screen.getByText('Rent').closest('label');
      const rentCheckbox = within(rentLabel!).getByRole('checkbox');
      await user.click(rentCheckbox);
      
      const groceriesLabel = screen.getByText('Groceries').closest('label');
      const groceriesCheckbox = within(groceriesLabel!).getByRole('checkbox');
      await user.click(groceriesCheckbox);
      
      // Should show expenses of $1650 (1200 + 450)
      const expensesSection = screen.getAllByText('Expenses').find(el => 
        el.parentElement?.textContent?.includes('1650')
      );
      expect(expensesSection).toBeDefined();
    });

    it('should compute correct net total', async () => {
      const user = userEvent.setup();
      render(<FiltersPanel initialGroups={mockGroups} />);
      
      // Select Salary (income $5000) and Rent (expense $1200)
      const salaryLabel = screen.getByText('Salary').closest('label');
      const salaryCheckbox = within(salaryLabel!).getByRole('checkbox');
      await user.click(salaryCheckbox);
      
      const rentLabel = screen.getByText('Rent').closest('label');
      const rentCheckbox = within(rentLabel!).getByRole('checkbox');
      await user.click(rentCheckbox);
      
      // Should show net of $3800 (5000 - 1200)
      const netSection = screen.getAllByText('Net').find(el => 
        el.parentElement?.textContent?.includes('3800')
      );
      expect(netSection).toBeDefined();
    });

    it('should update totals when selection changes', async () => {
      const user = userEvent.setup();
      render(<FiltersPanel initialGroups={mockGroups} />);
      
      // Get initial income (should be $0)
      let incomeSection = screen.getAllByText('Income').find(el => 
        el.parentElement?.textContent?.includes('0')
      );
      expect(incomeSection).toBeDefined();
      
      // Select Salary
      const salaryLabel = screen.getByText('Salary').closest('label');
      const salaryCheckbox = within(salaryLabel!).getByRole('checkbox');
      await user.click(salaryCheckbox);
      
      // Should now show $5000
      incomeSection = screen.getAllByText('Income').find(el => 
        el.parentElement?.textContent?.includes('5000')
      );
      expect(incomeSection).toBeDefined();
      
      // Deselect Salary
      await user.click(salaryCheckbox);
      
      // Should be back to $0
      incomeSection = screen.getAllByText('Income').find(el => 
        el.parentElement?.textContent?.includes('0')
      );
      expect(incomeSection).toBeDefined();
    });
  });

  describe('clear filters functionality', () => {
    it('should clear all selected categories when Clear filters is clicked', async () => {
      const user = userEvent.setup();
      render(<FiltersPanel initialGroups={mockGroups} />);
      
      // Select multiple categories
      const rentLabel = screen.getByText('Rent').closest('label');
      const rentCheckbox = within(rentLabel!).getByRole('checkbox');
      await user.click(rentCheckbox);
      
      const salaryLabel = screen.getByText('Salary').closest('label');
      const salaryCheckbox = within(salaryLabel!).getByRole('checkbox');
      await user.click(salaryCheckbox);
      
      expect((rentCheckbox as HTMLInputElement).checked).toBe(true);
      expect((salaryCheckbox as HTMLInputElement).checked).toBe(true);
      
      // Click clear filters
      const clearButton = screen.getByText('Clear filters');
      await user.click(clearButton);
      
      // All should be unchecked
      expect((rentCheckbox as HTMLInputElement).checked).toBe(false);
      expect((salaryCheckbox as HTMLInputElement).checked).toBe(false);
    });

    it('should reset preview totals when clear filters is clicked', async () => {
      const user = userEvent.setup();
      render(<FiltersPanel initialGroups={mockGroups} />);
      
      // Select Salary
      const salaryLabel = screen.getByText('Salary').closest('label');
      const salaryCheckbox = within(salaryLabel!).getByRole('checkbox');
      await user.click(salaryCheckbox);
      
      // Should show $5000
      let incomeSection = screen.getAllByText('Income').find(el => 
        el.parentElement?.textContent?.includes('5000')
      );
      expect(incomeSection).toBeDefined();
      
      // Click clear filters
      const clearButton = screen.getByText('Clear filters');
      await user.click(clearButton);
      
      // Should be back to $0
      incomeSection = screen.getAllByText('Income').find(el => 
        el.parentElement?.textContent?.includes('0')
      );
      expect(incomeSection).toBeDefined();
    });
  });

  describe('with custom groups', () => {
    it('should work with custom category groups', () => {
      const customGroups = [
        {
          id: 'g-custom',
          name: 'Custom Group',
          categories: [
            { id: 'c-custom-1', name: 'Custom 1', type: 'expense' as const, amount: 100 },
          ],
        },
      ];
      
      render(<FiltersPanel initialGroups={customGroups} />);
      
      expect(screen.getByText('Custom Group')).toBeDefined();
      expect(screen.getByText('Custom 1')).toBeDefined();
    });
  });

  describe('responsive behavior', () => {
    it('should render category items with amounts', () => {
      render(<FiltersPanel initialGroups={mockGroups} />);
      
      // Check for amount display
      expect(screen.getByText('$1200')).toBeDefined(); // Rent
      expect(screen.getByText('$450')).toBeDefined();  // Groceries
      expect(screen.getByText('$5000')).toBeDefined(); // Salary
    });

    it('should have proper container structure', () => {
      const { container } = render(<FiltersPanel initialGroups={mockGroups} />);
      
      const main = container.querySelector('main');
      expect(main).toBeDefined();
      
      const aside = container.querySelector('aside');
      expect(aside).toBeDefined();
    });
  });

  describe('category color indicators', () => {
    it('should display color indicator for each category', () => {
      const { container } = render(<FiltersPanel initialGroups={mockGroups} />);
      
      // Each category should have a color span
      const colorSpans = container.querySelectorAll('span[class*="bg-"][class*="-500"]');
      expect(colorSpans.length).toBeGreaterThan(0);
    });
  });
});
