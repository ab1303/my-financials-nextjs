'use client';

import { toast } from 'sonner';

import type { RuleListItem } from '@/server/services/transactions/transfer-rule.service';
import { trpc } from '@/server/trpc/client';

interface TransferRulesTableProps {
  initialRules: RuleListItem[];
}

export default function TransferRulesTable({ initialRules }: TransferRulesTableProps) {
  const utils = trpc.useUtils();

  const { data: rules = initialRules } = trpc.transferRule.listRules.useQuery(undefined, {
    initialData: initialRules,
  });

  const toggleMutation = trpc.transferRule.toggleRule.useMutation({
    onSuccess: async (_, variables) => {
      await utils.transferRule.listRules.invalidate();
      toast.success(variables.isActive ? 'Rule activated' : 'Rule deactivated');
    },
    onError: (err) => toast.error(err.message ?? 'Failed to toggle rule'),
  });

  const deleteMutation = trpc.transferRule.deleteRule.useMutation({
    onSuccess: async () => {
      await utils.transferRule.listRules.invalidate();
      toast.success('Rule deleted');
    },
    onError: (err) => toast.error(err.message ?? 'Failed to delete rule'),
  });

  if (rules.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
        <p className="text-sm text-muted-foreground">No transfer match rules yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Link a transfer pair and save it as a rule to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="cursor-default select-none px-4 py-3 text-left font-medium text-muted-foreground">
              Name
            </th>
            <th className="cursor-default select-none px-4 py-3 text-left font-medium text-muted-foreground">
              Amount
            </th>
            <th className="cursor-default select-none px-4 py-3 text-left font-medium text-muted-foreground">
              Max Gap
            </th>
            <th className="cursor-default select-none px-4 py-3 text-left font-medium text-muted-foreground">
              Threshold
            </th>
            <th className="cursor-default select-none px-4 py-3 text-left font-medium text-muted-foreground">
              Matches
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
              <td className="px-4 py-3 tabular-nums text-muted-foreground">
                {rule.amountExact ? `$${rule.amountExact.toFixed(2)}` : '—'}
              </td>
              <td className="px-4 py-3 tabular-nums text-muted-foreground">{rule.maxDayGap}d</td>
              <td className="px-4 py-3 tabular-nums text-muted-foreground">
                {rule.confidenceThreshold}%
              </td>
              <td className="px-4 py-3 tabular-nums text-muted-foreground">{rule.matchCount}</td>
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
                <button
                  type="button"
                  aria-label={`Delete rule ${rule.name}`}
                  onClick={() => {
                    if (confirm(`Delete rule "${rule.name}"?`)) {
                      deleteMutation.mutate({ ruleId: rule.id });
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
