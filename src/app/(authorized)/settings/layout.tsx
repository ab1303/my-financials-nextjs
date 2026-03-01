import * as React from 'react';
import clsx from 'clsx';
import { layoutStyles } from '@/styles/theme';

export default async function SettingsRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        'min-h-screen bg-gray-100 flex flex-col',
        layoutStyles.spacing.section,
      )}
    >
      <div
        className={clsx(
          'container min-w-full mx-auto',
          layoutStyles.container['3xl'], // Using theme utility instead of hardcoded width
        )}
      >
        {children}
      </div>
    </div>
  );
}
