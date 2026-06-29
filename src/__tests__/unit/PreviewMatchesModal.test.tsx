import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PreviewMatchesModal } from '@/components/transactions/PreviewMatchesModal';

interface PreviewMatch {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  category: string;
  status: string;
}

describe('PreviewMatchesModal', () => {
  const mockMatches: PreviewMatch[] = [
    {
      id: 'match-1',
      date: '2024-01-10',
      description: 'Supermarket Purchase',
      amount: -50.0,
      type: 'DEBIT',
      category: 'Groceries',
      status: 'CONFIRMED',
    },
    {
      id: 'match-2',
      date: '2024-01-20',
      description: 'Supermarket Purchase',
      amount: -75.5,
      type: 'DEBIT',
      category: 'Groceries',
      status: 'CONFIRMED',
    },
    {
      id: 'match-3',
      date: '2024-02-05',
      description: 'Supermarket Purchase',
      amount: -60.25,
      type: 'DEBIT',
      category: 'Groceries',
      status: 'CONFIRMED',
    },
  ];

  const defaultProps = {
    open: true,
    matches: mockMatches,
    totalCount: 3,
    hasMore: false,
    isLoadingMore: false,
    matchScope: 'recent' as const,
    onMatchScopeChange: vi.fn(),
    onCancel: vi.fn(),
    onApply: vi.fn(),
    onLoadMore: vi.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when open is false', () => {
    const { container } = render(
      <PreviewMatchesModal {...defaultProps} open={false} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('displays the modal title and transaction count', () => {
    render(<PreviewMatchesModal {...defaultProps} />);

    expect(screen.getByText('Preview Matching Transactions')).toBeDefined();
    expect(screen.getByText(/Found 3 similar transactions/)).toBeDefined();
    expect(screen.getByText(/showing 3 loaded/)).toBeDefined();
  });

  it('uses a scrollable viewport shell when the dialog grows tall', () => {
    render(<PreviewMatchesModal {...defaultProps} />);

    const overlay = document.body.querySelector('div.fixed.inset-0.z-50');
    expect(overlay).toBeTruthy();
    expect(overlay).toHaveClass('overflow-y-auto');

    const panel = overlay?.querySelector('div.mx-auto');
    expect(panel).toBeTruthy();
    expect(panel).toHaveClass('max-h-[calc(100dvh-2rem)]');
  });

  it('renders all matched transactions in the table', () => {
    render(<PreviewMatchesModal {...defaultProps} />);

    // Check that all transactions are rendered by finding the table cells
    const dateElements = screen.getAllByText('2024-01-10');
    expect(dateElements).toHaveLength(1);

    const descriptions = screen.getAllByText('Supermarket Purchase');
    expect(descriptions).toHaveLength(3); // One for each row
  });

  it('renders checkboxes for each transaction row', () => {
    render(<PreviewMatchesModal {...defaultProps} />);

    // Should have one checkbox per match (no select-all checkbox anymore)
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(mockMatches.length);
  });

  it('renders checkboxes unchecked by default', () => {
    render(<PreviewMatchesModal {...defaultProps} />);

    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((checkbox) => {
      expect((checkbox as HTMLInputElement).checked).toBe(false);
    });
  });

  it('allows checking individual checkboxes', async () => {
    render(<PreviewMatchesModal {...defaultProps} />);

    const checkboxes = screen.getAllByRole('checkbox');
    const firstCheckbox = checkboxes[0];
    expect(firstCheckbox).toBeDefined();
    fireEvent.click(firstCheckbox!);

    await waitFor(() => {
      expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
    });

    expect((checkboxes[1] as HTMLInputElement).checked).toBe(false);
  });

  it('disables Apply button when no checkboxes are selected', () => {
    render(<PreviewMatchesModal {...defaultProps} />);

    const applyButton = screen.getByRole('button', { name: /apply/i });
    expect(applyButton).toHaveAttribute('disabled');
  });

  it('enables Apply button when at least one checkbox is selected', async () => {
    render(<PreviewMatchesModal {...defaultProps} />);

    const checkboxes = screen.getAllByRole('checkbox');
    const applyButton = screen.getByRole('button', { name: /apply/i });

    // Initially disabled
    expect(applyButton).toHaveAttribute('disabled');

    // Check first checkbox
    const firstCheckbox = checkboxes[0];
    expect(firstCheckbox).toBeDefined();
    fireEvent.click(firstCheckbox!);

    // Should now be enabled
    await waitFor(() => {
      expect(applyButton).not.toHaveAttribute('disabled');
    });
  });

  it('calls onApply with selected transaction IDs when Apply is clicked', async () => {
    const onApply = vi.fn();

    render(<PreviewMatchesModal {...defaultProps} onApply={onApply} />);

    const checkboxes = screen.getAllByRole('checkbox');

    // Select first and third transactions
    const firstCheckbox = checkboxes[0];
    const thirdCheckbox = checkboxes[2];
    expect(firstCheckbox).toBeDefined();
    expect(thirdCheckbox).toBeDefined();
    fireEvent.click(firstCheckbox!);
    fireEvent.click(thirdCheckbox!);

    const applyButton = screen.getByRole('button', { name: /apply/i });

    await waitFor(() => {
      expect(applyButton).not.toHaveAttribute('disabled');
    });

    fireEvent.click(applyButton);

    expect(onApply).toHaveBeenCalledWith(['match-1', 'match-3']);
  });

  it('calls onApply with all selected IDs when multiple checkboxes are selected', () => {
    const onApply = vi.fn();

    render(<PreviewMatchesModal {...defaultProps} onApply={onApply} />);

    const checkboxes = screen.getAllByRole('checkbox');

    // Select all transactions
    checkboxes.forEach((checkbox) => {
      fireEvent.click(checkbox);
    });

    const applyButton = screen.getByRole('button', { name: /apply/i });
    fireEvent.click(applyButton);

    expect(onApply).toHaveBeenCalledWith(['match-1', 'match-2', 'match-3']);
  });

  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn();

    render(<PreviewMatchesModal {...defaultProps} onCancel={onCancel} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onMatchScopeChange when scope buttons are clicked', () => {
    const onMatchScopeChange = vi.fn();

    render(
      <PreviewMatchesModal
        {...defaultProps}
        matchScope='recent'
        onMatchScopeChange={onMatchScopeChange}
      />,
    );

    const allTimeButton = screen.getByRole('button', { name: /all time/i });
    fireEvent.click(allTimeButton);

    expect(onMatchScopeChange).toHaveBeenCalledWith('all');
  });

  it('renders a Load more button when more rows are available', () => {
    const onLoadMore = vi.fn();

    render(
      <PreviewMatchesModal
        {...defaultProps}
        hasMore={true}
        onLoadMore={onLoadMore}
      />,
    );

    const loadMoreButton = screen.getByRole('button', { name: /load more/i });
    fireEvent.click(loadMoreButton);

    expect(onLoadMore).toHaveBeenCalled();
  });

  it('keeps selected rows when more matches are appended', async () => {
    const { rerender } = render(<PreviewMatchesModal {...defaultProps} />);

    const firstCheckbox = screen.getAllByRole('checkbox')[0];
    expect(firstCheckbox).toBeDefined();
    fireEvent.click(firstCheckbox!);

    await waitFor(() => {
      expect((firstCheckbox as HTMLInputElement).checked).toBe(true);
    });

    rerender(
      <PreviewMatchesModal
        {...defaultProps}
        matches={[
          ...mockMatches,
          {
            id: 'match-4',
            date: '2024-02-10',
            description: 'Supermarket Purchase',
            amount: -42.25,
            type: 'DEBIT',
            category: 'Groceries',
            status: 'CONFIRMED',
          },
        ]}
        totalCount={4}
      />,
    );

    expect(
      (screen.getAllByRole('checkbox')[0] as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (screen.getAllByRole('checkbox')[3] as HTMLInputElement).checked,
    ).toBe(false);
  });

  it('shows message when no matches found', () => {
    render(<PreviewMatchesModal {...defaultProps} matches={[]} />);

    expect(screen.getByText('No matching transactions found')).toBeDefined();
  });

  it('disables Apply button when matches are empty', () => {
    render(<PreviewMatchesModal {...defaultProps} matches={[]} />);

    const applyButton = screen.getByRole('button', { name: /apply/i });
    expect(applyButton).toHaveAttribute('disabled');
  });

  it('disables buttons when isLoading is true', () => {
    render(<PreviewMatchesModal {...defaultProps} isLoading={true} />);

    const applyButton = screen.getByRole('button', { name: /applying/i });
    const cancelButton = screen.getByRole('button', { name: /cancel/i });

    expect(applyButton).toHaveAttribute('disabled');
    expect(cancelButton).toHaveAttribute('disabled');
  });
});
