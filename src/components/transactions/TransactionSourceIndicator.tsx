'use client';

import { BotIcon, Pencil } from 'lucide-react';

type TransactionSource = 'LLM_CLASSIFIED' | 'USER_OVERRIDE' | string;

interface TransactionSourceIndicatorProps {
  source: TransactionSource;
}

const SOURCE_META: Record<
  'LLM_CLASSIFIED' | 'USER_OVERRIDE',
  {
    label: string;
    className: string;
    icon: typeof BotIcon;
  }
> = {
  LLM_CLASSIFIED: {
    label: 'AI classified',
    className: 'text-sky-500 dark:text-sky-400',
    icon: BotIcon,
  },
  USER_OVERRIDE: {
    label: 'Set by you',
    className: 'text-emerald-500 dark:text-emerald-400',
    icon: Pencil,
  },
};

export default function TransactionSourceIndicator({ source }: TransactionSourceIndicatorProps) {
  const meta = SOURCE_META[source as keyof typeof SOURCE_META];

  if (!meta) {
    return (
      <span className="inline-flex items-center justify-center text-xs text-gray-400 dark:text-gray-500" title={source}>
        ?
      </span>
    );
  }

  const Icon = meta.icon;

  return (
    <span
      role="img"
      aria-label={meta.label}
      title={meta.label}
      className={`inline-flex items-center justify-center ${meta.className}`}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}
