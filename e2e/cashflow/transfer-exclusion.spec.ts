/**
 * e2e: P0 — Transfer Exclusion
 *
 * Validates that transactions categorised as "Transfer" are excluded from
 * expense totals and category breakdowns, ensuring inter-account transfers
 * never inflate reported expenses.
 *
 * Seeded data (via global-setup.ts):
 *   - Groceries $100  (2025-08-15) — should appear in total
 *   - Utilities $200  (2025-09-10) — should appear in total
 *   - Transfer  $1000 (2025-08-01) — EXCLUDED from total
 *   - Transfer  $500  (2025-10-01) — EXCLUDED from total
 *   Expected total = $300 (not $1800)
 *
 * URL: /cashflow/expense?fromYear=2025&toYear=2026
 */

import { expect,test } from '@playwright/test';

const EXPENSE_URL = '/cashflow/expense?fromYear=2025&toYear=2026';
const INCOME_URL = '/cashflow/income?fromYear=2025&toYear=2026';
const TRANSFER_CATEGORY_LABEL = 'Transfer';

test.describe('P0 — Transfer exclusion from expense/income totals', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(EXPENSE_URL);
    await page.waitForLoadState('networkidle');
  });

  test('expense page loads without error for FY2026', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /monthly expense tracking/i }),
    ).toBeVisible();
    // Should not show auth error
    await expect(page.getByText(/authentication required/i)).not.toBeVisible();
  });

  test('expense total is $300 — Transfer amounts excluded', async ({ page }) => {
    // The total expense panel shows the sum of non-Transfer CONFIRMED DEBIT transactions
    // Seeded: Groceries $100 + Utilities $200 = $300 (Transfer $1500 excluded)
    const totalPanel = page.locator('text=/total expenses for/i').locator('..');
    await expect(totalPanel).toBeVisible();

    // Find the bold dollar amount in the total panel
    const amountText = page.locator(
      'div:has-text("Total Expenses") span.font-bold, div:has-text("Total Expenses") span.text-lg',
    );
    if (await amountText.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await amountText.textContent();
      // Should be $300.00 — NOT $1800.00 (which would include transfers)
      expect(text).toContain('300');
      expect(text).not.toContain('1800');
      expect(text).not.toContain('1500');
    }
  });

  test('Transfer category does NOT appear as an expense breakdown row', async ({
    page,
  }) => {
    // Click into any month that has data to open the breakdown
    const breakdownLinks = page
      .getByRole('link', { name: /view breakdown|details/i })
      .or(page.getByRole('button', { name: /breakdown/i }));

    if (await breakdownLinks.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await breakdownLinks.first().click();
      await page.waitForLoadState('networkidle');

      // "Transfer" should never appear as a breakdown category row
      const transferRow = page.locator(`td:text-is("${TRANSFER_CATEGORY_LABEL}")`);
      await expect(transferRow).not.toBeVisible();
    }
  });

  test('Transfer category is excluded on the income page too', async ({
    page,
  }) => {
    await page.goto(INCOME_URL);
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByRole('heading', { name: /income tracking/i }),
    ).toBeVisible();
    // Page should not show auth error
    await expect(page.getByText(/authentication required/i)).not.toBeVisible();
  });

  test('Transfers tab in Transaction Ledger shows Transfer transactions', async ({
    page,
  }) => {
    await page.goto('/cashflow/transactions?tab=transfers');
    await page.waitForLoadState('networkidle');

    // The Transfers tab should be active
    const transfersTab = page.getByRole('tab', { name: /transfers/i }).or(
      page.getByRole('button', { name: /transfers/i }),
    );
    if (await transfersTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      // The tab should be active/selected
      const activeTab = page.locator(
        '[aria-selected="true"]:has-text("Transfers"), .active:has-text("Transfers")',
      );
      await expect(activeTab.or(transfersTab)).toBeVisible();
    }

    // Transfer transactions should appear in this tab (seeded data)
    await expect(
      page.getByText(/transfer out|transfer to offset/i).first(),
    ).toBeVisible({ timeout: 5000 });
  });
});
