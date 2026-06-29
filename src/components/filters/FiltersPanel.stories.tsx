import type { Meta, StoryObj } from '@storybook/react';

import mockGroups from '@/lib/mockFilterData';

import { FiltersPanel } from '../ui/filters';

/**
 * FiltersPanel - Interactive category filter panel with live preview totals
 *
 * Features (Phase 2 - Grouped Category Selectors):
 * - React-select grouped multi-selector for category selection
 * - Categories organized under their authored group headings
 * - Single Ungrouped bucket for categories not assigned to any group
 * - Live preview of income, expenses, and net totals
 * - Clear filters button to reset all selections
 * - Fully keyboard accessible
 * - Legacy checkbox panel available for backward compatibility
 */
const meta = {
  title: 'Components/FiltersPanel',
  component: FiltersPanel,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof FiltersPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default story showing the grouped select filter panel
 * Categories are grouped by their assigned group heading
 * Uses react-select with GroupBase for organized presentation
 */
export const Default: Story = {
  args: {
    initialGroups: mockGroups,
    useGroupedSelect: true,
  },
  render: (args) => (
    <div className='w-full bg-white dark:bg-slate-950 p-8'>
      <FiltersPanel {...args} />
    </div>
  ),
};

/**
 * Interactive demo showing the grouped category selector experience
 * Users can:
 * - Select/deselect categories from the grouped dropdown
 * - See categories organized by their group heading
 * - See Ungrouped bucket for unassigned categories
 * - See preview totals update in real-time
 * - Clear all filters with one button
 */
export const InteractiveGroupedSelect: Story = {
  args: {
    initialGroups: mockGroups,
    useGroupedSelect: true,
  },
  render: (args) => (
    <div className='w-full bg-white dark:bg-slate-950 p-8'>
      <div className='mb-4'>
        <h2 className='text-2xl font-bold mb-2'>
          Category Filtering Demo (Phase 2)
        </h2>
        <p className='text-slate-600 dark:text-slate-400'>
          Select categories using the grouped dropdown. Categories are organized
          by their group heading with an Ungrouped bucket for unassigned items.
        </p>
      </div>
      <FiltersPanel {...args} />
    </div>
  ),
};

/**
 * Legacy checkbox panel for backward compatibility
 * Shows the original tri-state checkbox UI
 */
export const LegacyCheckboxPanel: Story = {
  args: {
    initialGroups: mockGroups,
    useGroupedSelect: false,
  },
  render: (args) => (
    <div className='w-full bg-white dark:bg-slate-950 p-8'>
      <div className='mb-4'>
        <h2 className='text-2xl font-bold mb-2'>Legacy Checkbox Panel</h2>
        <p className='text-slate-600 dark:text-slate-400'>
          Original tri-state checkbox interface for category selection.
        </p>
      </div>
      <FiltersPanel {...args} />
    </div>
  ),
};

/**
 * Minimal story with a small set of categories
 */
export const WithMinimalGroups: Story = {
  args: {
    initialGroups: [
      {
        id: 'g-income',
        name: 'Income',
        categories: [
          {
            id: 'c-salary',
            name: 'Salary',
            color: 'bg-yellow-500',
            type: 'income' as const,
            amount: 5000,
          },
        ],
      },
      {
        id: 'g-expenses',
        name: 'Expenses',
        categories: [
          {
            id: 'c-rent',
            name: 'Rent',
            color: 'bg-blue-500',
            type: 'expense' as const,
            amount: 1200,
          },
        ],
      },
    ],
    useGroupedSelect: true,
  },
  render: (args) => (
    <div className='w-full bg-white dark:bg-slate-950 p-8'>
      <FiltersPanel {...args} />
    </div>
  ),
};
