interface CategoryRulePromptProps {
  count: number;
  colCount: number;
  onCreateRule: () => void;
  onDismiss: () => void;
}

export default function CategoryRulePrompt({
  count,
  colCount,
  onCreateRule,
  onDismiss,
}: CategoryRulePromptProps) {
  return (
    <tr>
      <td
        colSpan={colCount}
        className="bg-amber-50 px-4 py-2 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-amber-800 dark:text-amber-200">
            📋 Found {count} similar transaction{count !== 1 ? 's' : ''}. Save as a category rule?
          </span>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={onCreateRule}
              className="rounded px-3 py-1 text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-800 dark:text-amber-100 dark:hover:bg-amber-700 transition-colors"
            >
              Create Rule
            </button>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss rule suggestion"
              className="text-xs text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
            >
              ✕
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}
