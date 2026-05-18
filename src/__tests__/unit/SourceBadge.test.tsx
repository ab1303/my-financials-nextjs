import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import SourceBadge, { SOURCE_COLOR_MAP } from '@/app/(authorized)/cashflow/income/_components/SourceBadge';

describe('SourceBadge', () => {
  it('renders the source name text', () => {
    render(<SourceBadge sourceName='Employment' />);

    expect(screen.getByText('Employment')).toBeInTheDocument();
  });

  it('applies blue classes for "Employment"', () => {
    render(<SourceBadge sourceName='Employment' />);

    expect(screen.getByText('Employment')).toHaveClass(
      'bg-blue-100',
      'text-blue-800',
      'dark:bg-blue-900/40',
      'dark:text-blue-300',
    );
    expect(SOURCE_COLOR_MAP.employment).toBe(
      'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    );
  });

  it('falls back to gray for unknown source "Crypto"', () => {
    render(<SourceBadge sourceName='Crypto' />);

    expect(screen.getByText('Crypto')).toHaveClass(
      'bg-gray-100',
      'text-gray-700',
      'dark:bg-gray-600/60',
      'dark:text-gray-100',
    );
  });

  it('is case-insensitive ("EMPLOYMENT" → blue)', () => {
    render(<SourceBadge sourceName='EMPLOYMENT' />);

    expect(screen.getByText('EMPLOYMENT')).toHaveClass(
      'bg-blue-100',
      'text-blue-800',
      'dark:bg-blue-900/40',
      'dark:text-blue-300',
    );
  });
});
