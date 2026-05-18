// Color map keyed on IncomeSource.name (case-insensitive match)
// Dark-mode safe: every entry has both light and dark Tailwind classes

export const SOURCE_COLOR_MAP: Record<string, string> = {
  employment: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  stocks: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  dividend: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  rental: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  business: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  interest: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-600/60 dark:text-gray-100',
};

const FALLBACK = 'bg-gray-100 text-gray-700 dark:bg-gray-600/60 dark:text-gray-100';

type Props = { sourceName: string };

export default function SourceBadge({ sourceName }: Props) {
  const colorClass = SOURCE_COLOR_MAP[sourceName.toLowerCase()] ?? FALLBACK;

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}>
      {sourceName}
    </span>
  );
}
