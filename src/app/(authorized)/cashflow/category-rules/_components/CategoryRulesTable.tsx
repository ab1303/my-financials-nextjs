'use client';

import { toast } from 'sonner';

import type { CategoryRuleListItem } from '@/server/services/transactions/category-rule.service';
import { trpc } from '@/server/trpc/client';

interface CategoryRulesTableProps {
  initialRules: CategoryRuleListItem[];
}

export default function CategoryRulesTable({ initialRules }: CategoryRulesTableProps) {
  const utils = trpc.useUtils();

  const { data: rules = initialRules } = trpc.categoryRule.list.useQuery(undefined, {
    initialData: initialRules,
  });

  const toggleMutation = trpc.categoryRule.toggle.useMutation({
    onSuccess: async (_, variables) => {
      await utils.categoryRule.list.invalidate();
      toast.success(variables.isActive ? 'Rule activated' : 'Rule deactivated');
    },
    onError: (err) => toast.error(err.message ?? 'Failed to toggle rule'),
  });

  const deleteMutation = trpc.categoryRule.delete.useMutation({
    onSuccess: async () => {
      await utils.categoryRule.list.invalidate();
      toast.success('Rule deleted');
    },
    onError: (err) => toast.error(err.message ?? 'Failed to delete rule'),
  });

  const applyToPastMutation = trpc.categoryRule.applyToPast.useMutation({
    onSuccess: async (data) => {
      await utils.categoryRule.list.invalidate();
      toast.success(`Applied to ${data.updatedCount} past transactions`);
    },
    onError: (err) => toast.error(err.message ?? 'Failed to apply rule to past transactions'),
  });

  if (rules.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
        <p className="text-sm text-muted-foreground">No category rules yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Change a transaction&apos;s category and save it as a rule to get started.
        </p>
      </div>
    );
  }

  const getMatchTypeBadgeColor = (matchType: string) => {
    switch (matchType) {
      case 'CONTAINS':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      case 'STARTS_WITH':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'EXACT':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="cursor-default select-none px-4 py-3 text-left font-medium text-muted-foreground">
              Name
            </th>
            <th className="cursor-default select-none px-4 py-3 text-left font-medium text-muted-foreground">
              Pattern
            </th>
            <th className="cursor-default select-none px-4 py-3 text-left font-medium text-muted-foreground">
              Match Type
            </th>
            <th className="cursor-default select-none px-4 py-3 text-left font-medium text-muted-foreground">
              Category
            </th>
            <th className="cursor-default select-none px-4 py-3 text-left font-medium text-muted-foreground">
              Applied
            </th>
            <th className="cursor-default select-none px-4 py-3 text-left font-medium text-muted-foreground">
              Active
            </th>
            <th className="cursor-default select-none px-4 py-3 text-left font-medium text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.id} className="border-t border-border hover:bg-muted/50">
              <td className="px-4 py-3 font-medium text-foreground">{rule.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{rule.pattern}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getMatchTypeBadgeColor(rule.matchType)}`}
                >
                  {rule.matchType}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{rule.category}</td>
              <td className="px-4 py-3 tabular-nums text-muted-foreground">{rule.appliedCount}</td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() =>
                    toggleMutation.mutate({ ruleId: rule.id, isActive: !rule.isActive })
                  }
                  disabled={toggleMutation.isPending}
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    rule.isActive
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}
                >
                  {rule.isActive ? 'Active' : 'Inactive'}
                </button>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => applyToPastMutation.mutate({ ruleId: rule.id })}
                    disabled={applyToPastMutation.isPending}
                    className="text-xs text-teal-600 hover:text-teal-700 disabled:opacity-50 dark:text-teal-400 dark:hover:text-teal-300"
                  >
                    Apply to Past
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete rule ${rule.name}`}
                    onClick={() => {
                      if (confirm(`Delete rule "${rule.name}"?`)) {
                        deleteMutation.mutate({ ruleId: rule.id });
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
