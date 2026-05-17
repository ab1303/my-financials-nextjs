'use client';

import { Info } from 'lucide-react';

interface InfoTooltipProps {
  text: string;
}

export default function InfoTooltip({ text }: InfoTooltipProps) {
  return (
    <span className="group relative shrink-0">
      <Info className="h-3.5 w-3.5 opacity-50" aria-hidden="true" />
      <span
        role="tooltip"
        className={[
          // positioning: centred above the icon
          'absolute bottom-full left-1/2 mb-2 -translate-x-1/2',
          // sizing & text
          'w-56 rounded-md px-3 py-2 text-xs font-normal leading-snug',
          // colours
          'bg-gray-800 text-gray-100 dark:bg-gray-700 dark:text-gray-200',
          // shadow & pointer
          'shadow-lg',
          // arrow
          'after:absolute after:left-1/2 after:top-full after:-translate-x-1/2',
          'after:border-4 after:border-transparent after:border-t-gray-800 after:content-[""]',
          'dark:after:border-t-gray-700',
          // visibility
          'invisible opacity-0 transition-opacity duration-150 group-hover:visible group-hover:opacity-100',
          // prevent wrapping from collapsing the width
          'whitespace-normal',
          // sit above everything
          'z-50 pointer-events-none',
        ].join(' ')}
      >
        {text}
      </span>
    </span>
  );
}
