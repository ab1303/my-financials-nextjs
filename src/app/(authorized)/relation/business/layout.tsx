import * as React from 'react';
import clsx from 'clsx';
import { layoutStyles } from '@/styles/theme';

export default function BusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        'min-h-screen bg-gray-100 flex flex-col',
        layoutStyles.spacing.section,
        layoutStyles.spacing.sectionLg,
      )}
    >
      <div
        className={clsx(
          'container min-w-full mx-auto',
          layoutStyles.container['3xl'],
        )}
      >
        {children}
      </div>
    </div>
  );
}
