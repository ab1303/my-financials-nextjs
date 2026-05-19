import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CGTEligibilityWarning } from '@/components/ui/CGTEligibilityWarning';
import { addMonths } from 'date-fns';

describe('CGTEligibilityWarning', () => {
  // Test 1: CGT warning displays 'Buy date not specified' when buyDate is null
  it('renders "Buy date not specified" when buyDate is null', () => {
    render(<CGTEligibilityWarning buyDate={null} snapshotDate={new Date()} />);
    
    const text = screen.getByText(/Buy date not specified/);
    expect(text).toBeInTheDocument();
    
    // Should show warning icon (⚠️) for null
    const warning = screen.getByText('⚠️');
    expect(warning).toBeInTheDocument();
    
    // Should have warning color (amber)
    expect(text.parentElement).toHaveClass('text-amber-600', 'dark:text-amber-400');
  });

  // Test 2: CGT warning displays 'Buy date not specified' when buyDate is undefined
  it('renders "Buy date not specified" when buyDate is undefined', () => {
    render(<CGTEligibilityWarning buyDate={undefined} snapshotDate={new Date()} />);
    
    expect(screen.getByText(/Buy date not specified/)).toBeInTheDocument();
    expect(screen.getByText('⚠️')).toBeInTheDocument();
  });

  // Test 3: CGT warning displays months to eligibility when buyDate is recent (< 12 months)
  it('renders months remaining when buyDate is less than 12 months old', () => {
    const snapshotDate = new Date('2024-06-15');
    const buyDate = new Date('2024-01-15'); // 5 months before snapshot
    
    render(<CGTEligibilityWarning buyDate={buyDate} snapshotDate={snapshotDate} />);
    
    const text = screen.getByText(/months to CGT discount/);
    expect(text).toBeInTheDocument();
    expect(text.textContent).toContain('7 months'); // 7 months remaining
    expect(text.textContent).toContain('CGT discount requires 12+ months');
    
    // Should show warning icon (⚠️) for warning
    expect(screen.getByText('⚠️')).toBeInTheDocument();
    
    // Should have warning color (amber)
    expect(text.parentElement).toHaveClass('text-amber-600', 'dark:text-amber-400');
  });

  // Test 4: CGT warning displays 'Eligible now' when buyDate is 12+ months old
  it('renders "Eligible now" when buyDate is 12+ months old', () => {
    const snapshotDate = new Date('2024-06-15');
    const buyDate = new Date('2023-01-15'); // 17 months before snapshot
    
    render(<CGTEligibilityWarning buyDate={buyDate} snapshotDate={snapshotDate} />);
    
    const text = screen.getByText(/Eligible now/);
    expect(text).toBeInTheDocument();
    
    // Should show success icon (✅) for eligible
    expect(screen.getByText('✅')).toBeInTheDocument();
    
    // Should NOT show warning icon
    expect(screen.queryByText('⚠️')).not.toBeInTheDocument();
    
    // Should have success color (green)
    expect(text.parentElement).toHaveClass('text-green-600', 'dark:text-green-400');
  });

  // Test 5: CGT warning uses custom snapshotDate if provided
  it('uses custom snapshotDate for calculations', () => {
    // Today is future date
    const snapshotDate = new Date('2025-12-15');
    // Buy date is 11 months before snapshot
    const buyDate = new Date('2025-01-15');
    
    render(<CGTEligibilityWarning buyDate={buyDate} snapshotDate={snapshotDate} />);
    
    // Should show 1 month remaining
    const text = screen.getByText(/1 month to CGT discount/);
    expect(text).toBeInTheDocument();
  });

  // Test 6: CGT warning defaults to today if snapshotDate not provided
  it('defaults to today when snapshotDate is not provided', () => {
    const today = new Date();
    const almost12MonthsAgo = addMonths(today, -11);
    
    render(<CGTEligibilityWarning buyDate={almost12MonthsAgo} />);
    
    // Should show approximately 1 month remaining
    const text = screen.getByText(/months? to CGT discount/);
    expect(text).toBeInTheDocument();
  });

  // Test 7: Edge case - exactly 12 months (should be eligible)
  it('renders "Eligible now" when exactly 12 months have passed', () => {
    const snapshotDate = new Date('2024-06-15');
    const buyDate = new Date('2023-06-15'); // exactly 12 months before
    
    render(<CGTEligibilityWarning buyDate={buyDate} snapshotDate={snapshotDate} />);
    
    expect(screen.getByText(/Eligible now/)).toBeInTheDocument();
    expect(screen.getByText('✅')).toBeInTheDocument();
  });

  // Test 8: Edge case - 1 day before eligibility
  it('shows "12 months to CGT discount" when 1 day before eligibility', () => {
    const snapshotDate = new Date('2024-06-14');
    const buyDate = new Date('2023-06-15'); // 1 day before eligibility
    
    render(<CGTEligibilityWarning buyDate={buyDate} snapshotDate={snapshotDate} />);
    
    // Should show warning since not quite 12 months
    expect(screen.getByText('⚠️')).toBeInTheDocument();
  });
});
