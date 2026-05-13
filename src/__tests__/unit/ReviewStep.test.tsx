import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/(authorized)/cashflow/transactions/_components/ai/ConfidenceBadge', () => ({
  default: ({ score }: { score: number }) => <span>{score}</span>,
}));

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ sessionId: 's1', recordsCreated: 2, status: 'COMPLETED' }),
}) as any;

import ReviewStep from '@/app/(authorized)/cashflow/transactions/_components/ai/ReviewStep';

const mockImages = [
  {
    imageId: 'img-1',
    fileName: 'receipt.jpg',
    confidence: 0.95,
    entries: [
      { id: 'e1', categoryName: 'Groceries', amount: 50, confirmed: true },
      { id: 'e2', categoryName: 'Transport', amount: 20, confirmed: true },
    ],
    status: 'success' as const,
  },
];

describe('ReviewStep', () => {
  const defaultProps = {
    sessionId: 'session-1',
    extractedImages: mockImages,
    categories: [
      { id: 'c1', name: 'Groceries' },
      { id: 'c2', name: 'Transport' },
    ],
    calendarYearId: 'cal-1',
    month: 1,
    onConfirm: vi.fn(),
    onBack: vi.fn(),
    isConfirming: false,
  };

  it('renders extracted entries', () => {
    render(<ReviewStep {...defaultProps} />);
    expect(screen.getAllByText('Groceries').length).toBeGreaterThan(0);
  });

  it('shows total confirmed count', () => {
    render(<ReviewStep {...defaultProps} />);
    expect(screen.getByText(/2 entries to import/)).toBeDefined();
  });

  it('calls onBack when back is clicked', () => {
    render(<ReviewStep {...defaultProps} />);
    fireEvent.click(screen.getByText(/Back/));
    expect(defaultProps.onBack).toHaveBeenCalledOnce();
  });

  it('can uncheck an entry', () => {
    render(<ReviewStep {...defaultProps} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]!);
    expect(screen.getByText(/1 entries to import/)).toBeDefined();
  });
});

