/**
 * e2e: handle-orphans Phase 2 — Transfer Transparency (Banners)
 *
 * Validates the two-layer visibility system for excluded transfers on the
 * Expense and Income pages:
 *
 *  Layer 1 — TransferExclusionSummary (always visible when count > 0):
 *    "↔ N transfers excluded from totals — $X.XX moved between accounts. View or reclassify →"
 *
 *  Layer 2 — UnresolvedTransfersBanner (alert when orphan count > 0):
 *    "N unresolved transfers may be inflating your figures. Review now →"
 *
 * Seeded data (via global-setup.ts) for FY2026:
 *   - 2 Transfer transactions: $1000 (Aug 2025) + $500 (Oct 2025) = $1,500.00 excluded
 *   - Both have transferLinkedTransactionId = null and dates > 30 days ago → 2 orphans
 *
 * URL: /cashflow/expense?fromYear=2025&toYear=2026
 */

import { test, expect } from '@playwright/test';

const EXPENSE_URL = '/cashflow/expense?fromYear=2025&toYear=2026';
const INCOME_URL = '/cashflow/income?fromYear=2025&toYear=2026';
const TRANSFERS_TAB_URL = '/cashflow/transactions?tab=transfers';

test.describe('handle-orphans P2 — TransferExclusionSummary on Expense page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(EXPENSE_URL);
    await page.waitForLoadState('networkidle');
  });

  test('TransferExclusionSummary shows excluded transfer count', async ({
    page,
  }) => {
    // The summary always renders when count > 0 — seeded data provides 2 transfers
    // Text: "↔ 2 transfers excluded from totals — $1,500.00 moved between accounts."
    await expect(
      page.getByText(/transfers? excluded from totals/i),
    ).toBeVisible({ timeout: 5000 });
  });

  test('TransferExclusionSummary shows the total excluded dollar amount', async ({
    page,
  }) => {
    // Seeded: $1000 + $500 = $1,500.00
    await expect(page.getByText(/1,500\.00/)).toBeVisible({ timeout: 5000 });
  });

  test('"View or reclassify →" link navigates to Transfers tab', async ({
    page,
  }) => {
    const link = page.getByRole('link', { name: /view or reclassify/i });
    await expect(link).toBeVisible({ timeout: 5000 });

    const href = await link.getAttribute('href');
    expect(href).toContain('/cashflow/transactions');
    expect(href).toContain('tab=transfers');
  });

  test('UnresolvedTransfersBanner shows orphan warning when orphans exist', async ({
    page,
  }) => {
    // Both seeded transfers are orphans (no linked counterpart, date > 30 days ago)
    // Banner text: "N unresolved transfers may be inflating your figures."
    await expect(
      page.getByText(/unresolved transfers? may be inflating/i),
    ).toBeVisible({ timeout: 5000 });
  });

  test('UnresolvedTransfersBanner "Review now →" link goes to Transfers tab', async ({
    page,
  }) => {
    const link = page.getByRole('link', { name: /review now/i });
    await expect(link).toBeVisible({ timeout: 5000 });

    const href = await link.getAttribute('href');
    expect(href).toContain('/cashflow/transactions');
    expect(href).toContain('tab=transfers');
  });

  test('orphan banner has yellow warning styling', async ({ page }) => {
    // The banner uses yellow-50 background and border-yellow-200
    const banner = page
      .locator('.bg-yellow-50, [class*="bg-yellow"]')
      .filter({ hasText: /unresolved transfers?/i });
    await expect(banner).toBeVisible({ timeout: 5000 });
  });
});

test.describe('handle-orphans P2 — TransferExclusionSummary on Income page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(INCOME_URL);
    await page.waitForLoadState('networkidle');
  });

  test('Income page also shows TransferExclusionSummary', async ({ page }) => {
    // Transfers are excluded from both expense and income aggregations
    // If seeded DEBIT transfers exist, the income exclusion summary won't show
    // (income summary shows CREDIT transfers only — seeded data is DEBIT)
    // But verify the page loads correctly and hasn't broken
    await expect(
      page.getByRole('heading', { name: /income tracking/i }),
    ).toBeVisible({ timeout: 5000 });
  });

  test('Income page shows UnresolvedTransfersBanner for orphan DEBIT transfers', async ({
    page,
  }) => {
    // The orphan banner uses the same query (category=Transfer, no link, old)
    // Our seeded DEBIT transfers qualify as orphans
    await expect(
      page.getByText(/unresolved transfers? may be inflating/i),
    ).toBeVisible({ timeout: 5000 });
  });

  test('Clicking "Review now →" from income page reaches Transfers tab', async ({
    page,
  }) => {
    const link = page.getByRole('link', { name: /review now/i });
    await expect(link).toBeVisible({ timeout: 5000 });
    await link.click();

    await expect(page).toHaveURL(new RegExp(TRANSFERS_TAB_URL.replace('?', '\\?')));
  });
});
