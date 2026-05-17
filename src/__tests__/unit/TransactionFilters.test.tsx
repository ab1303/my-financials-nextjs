import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TransactionFilters from '@/components/transactions/TransactionFilters';

vi.mock('react-select', () => ({
  default: ({
    inputId,
    name,
    options = [],
    value,
    onChange,
    placeholder,
    isClearable,
  }: {
    inputId?: string;
    name?: string;
    options?: Array<{ label: string; value: string }>;
    value?: { label: string; value: string } | null;
    onChange?: (option: { label: string; value: string } | null) => void;
    placeholder?: string;
    isClearable?: boolean;
  }) => (
    <select
      id={inputId}
      name={name}
      aria-label={placeholder ?? name}
      value={value?.value ?? ''}
      onChange={(event) => {
        const selected = options.find((option) => option.value === event.target.value) ?? null;
        onChange?.(selected);
      }}
    >
      {isClearable ? <option value="">All</option> : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

describe('TransactionFilters', () => {
  const props = {
    bankAccounts: [
      { id: 'acc-1', name: 'Everyday Account', bankName: 'CommBank' },
      { id: 'acc-2', name: 'Savings', bankName: 'ANZ' },
    ],
    categoryOptions: [],
    bankAccountId: undefined,
    category: undefined,
    dateFrom: undefined,
    dateTo: undefined,
    search: '',
    amountMin: '',
    amountMax: '',
    onBankChange: vi.fn(),
    onCategoryChange: vi.fn(),
    onDateFromChange: vi.fn(),
    onDateToChange: vi.fn(),
    onSearchChange: vi.fn(),
    onAmountMinChange: vi.fn(),
    onAmountMaxChange: vi.fn(),
    onReset: vi.fn(),
    resetKey: 0,
  };

  const openPeriodPanel = () => {
    fireEvent.click(screen.getByRole('button', { name: /period filter/i }));
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 7, 15, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders Period chip button with active preset label', () => {
    render(<TransactionFilters {...props} />);

    expect(screen.getByRole('button', { name: /period filter: this fy/i })).toBeInTheDocument();
  });

  it('period panel is collapsed by default', () => {
    render(<TransactionFilters {...props} />);

    expect(screen.queryByRole('button', { name: /^this month$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^last month$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^this quarter$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^last fy$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^custom$/i })).toBeNull();
  });

  it('clicking Period chip opens the accordion', () => {
    render(<TransactionFilters {...props} />);

    openPeriodPanel();

    expect(screen.getByRole('button', { name: /^this month$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^custom$/i })).toBeInTheDocument();
  });

  it('clicking Period chip twice closes the accordion', () => {
    render(<TransactionFilters {...props} />);

    openPeriodPanel();
    fireEvent.click(screen.getByRole('button', { name: /period filter/i }));

    expect(screen.queryByRole('button', { name: /^this month$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^custom$/i })).toBeNull();
  });

  it('Period chip shows aria-expanded="false" when collapsed', () => {
    render(<TransactionFilters {...props} />);

    expect(screen.getByRole('button', { name: /period filter/i })).toHaveAttribute('aria-expanded', 'false');
  });

  it('Period chip shows aria-expanded="true" when expanded', () => {
    render(<TransactionFilters {...props} />);

    openPeriodPanel();

    expect(screen.getByRole('button', { name: /period filter/i })).toHaveAttribute('aria-expanded', 'true');
  });

  it('clicking a preset pill calls date callbacks and closes the panel', () => {
    render(<TransactionFilters {...props} />);

    openPeriodPanel();
    fireEvent.click(screen.getByRole('button', { name: /^this month$/i }));

    expect(props.onDateFromChange).toHaveBeenCalledWith('2024-08-01');
    expect(props.onDateToChange).toHaveBeenCalledWith('2024-08-15');
    expect(screen.queryByRole('button', { name: /^this month$/i })).toBeNull();
  });

  it('clicking Custom pill keeps panel open', () => {
    render(<TransactionFilters {...props} />);

    openPeriodPanel();
    fireEvent.click(screen.getByRole('button', { name: /^custom$/i }));

    expect(screen.getByRole('button', { name: /period filter/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /^custom$/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking Custom shows date inputs', () => {
    render(<TransactionFilters {...props} />);

    openPeriodPanel();
    fireEvent.click(screen.getByRole('button', { name: /^custom$/i }));

    expect(screen.getByLabelText(/date from/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date to/i)).toBeInTheDocument();
  });

  it('hides date inputs for non-custom presets', () => {
    render(<TransactionFilters {...props} />);

    openPeriodPanel();
    fireEvent.click(screen.getByRole('button', { name: /^this quarter$/i }));

    expect(screen.queryByLabelText(/date from/i)).toBeNull();
    expect(screen.queryByLabelText(/date to/i)).toBeNull();
  });

  it('resets to This FY and collapses panel when resetKey changes', () => {
    const { rerender } = render(<TransactionFilters {...props} resetKey={0} />);

    openPeriodPanel();
    fireEvent.click(screen.getByRole('button', { name: /^custom$/i }));
    expect(screen.getByRole('button', { name: /period filter/i })).toHaveAttribute('aria-expanded', 'true');

    rerender(<TransactionFilters {...props} resetKey={1} />);

    expect(screen.getByRole('button', { name: /period filter: this fy/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText(/date from/i)).toBeNull();
  });

  it('amount min/max callbacks fire on input change', () => {
    render(<TransactionFilters {...props} />);

    fireEvent.change(screen.getByLabelText(/minimum amount/i), {
      target: { value: '500' },
    });

    fireEvent.change(screen.getByLabelText(/maximum amount/i), {
      target: { value: '1000' },
    });

    expect(props.onAmountMinChange).toHaveBeenCalledWith('500');
    expect(props.onAmountMaxChange).toHaveBeenCalledWith('1000');
  });

  it('bank account change callback fires', () => {
    render(<TransactionFilters {...props} />);

    fireEvent.change(screen.getByLabelText(/bank account/i), {
      target: { value: 'acc-2' },
    });

    expect(props.onBankChange).toHaveBeenCalledWith('acc-2');
  });
});
