'use client';

import type { ReactNode } from 'react';

interface ProfileSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function ProfileSection({
  title,
  description,
  children,
}: ProfileSectionProps) {
  return (
    <div className='rounded-xl border border-border bg-card p-6 shadow dark:border-gray-700 dark:bg-gray-800'>
      <h2 className='text-lg font-semibold text-foreground dark:text-white'>{title}</h2>
      {description && (
        <p className='mt-1 text-sm text-muted-foreground dark:text-gray-400'>
          {description}
        </p>
      )}
      <div className='mt-4'>{children}</div>
    </div>
  );
}
