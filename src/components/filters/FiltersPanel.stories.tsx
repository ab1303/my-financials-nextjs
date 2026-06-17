import type { Meta, StoryObj } from '@storybook/react';

import mockGroups from '@/lib/mockFilterData';

import { FiltersPanel } from '../ui/filters';

/**
 * FiltersPanel - Interactive category filter panel with live preview totals
 *
 * Features:
 * - Tri-state group checkboxes for selecting/deselecting all categories in a group
 * - Individual category checkboxes
 * - Live preview of income, expenses, and net totals
 * - Clear filters button to reset all selections
 * - Fully keyboard accessible with ARIA support
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
 * Default story showing the filters panel with all available mock groups
 * Categories start unselected, allowing users to choose what to include
 */
export const Default: Story = {
  args: {
    initialGroups: mockGroups,
  },
  render: (args) => (
    <div className="w-full bg-white dark:bg-slate-950 p-8">
      <FiltersPanel {...args} />
    </div>
  ),
};

/**
 * Interactive demo showing the full filtering experience
 * Users can:
 * - Toggle individual categories
 * - Use group checkboxes for quick select/deselect all
 * - See preview totals update in real-time
 * - Clear all filters with one button
 */
export const Interactive: Story = {
  args: {
    initialGroups: mockGroups,
  },
  render: (args) => (
    <div className="w-full bg-white dark:bg-slate-950 p-8">
      <div className="mb-4">
        <h2 className="text-2xl font-bold mb-2">Category Filtering Demo</h2>
        <p className="text-slate-600 dark:text-slate-400">
          Select categories to include in your totals. Use group checkboxes to quickly select or deselect all categories in a group.
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
          { id: 'c-salary', name: 'Salary', color: 'bg-yellow-500', type: 'income' as const, amount: 5000 },
        ],
      },
      {
        id: 'g-expenses',
        name: 'Expenses',
        categories: [
          { id: 'c-rent', name: 'Rent', color: 'bg-blue-500', type: 'expense' as const, amount: 1200 },
        ],
      },
    ],
  },
  render: (args) => (
    <div className="w-full bg-white dark:bg-slate-950 p-8">
      <FiltersPanel {...args} />
    </div>
  ),
};
