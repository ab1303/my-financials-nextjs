/**
 * e2e: improve-detection (Wave 4) — isTracked toggle on Bank Accounts page
 *
 * Validates the `isTracked` (account tracking) feature on /account/bank-accounts:
 *   - "Tracked" column is present in the accounts table
 *   - Toggle switch renders for each account, defaulting to ON (isTracked=true)
 *   - Clicking the toggle fires updateTracking mutation → shows success toast
 *   - Toggle state reflects persisted value on page reload
 *
 * Seeded data (via global-setup.ts):
 *   - "E2E Test Checking"  (E2E Test Bank, isTracked=true by default)
 *   - "E2E Savings Account" (E2E Test Bank, always reset to isTracked=true by global-setup)
 *
 * URL: /account/bank-accounts
 */

import { expect,test } from '@playwright/test';

const BANK_ACCOUNTS_URL = '/account/bank-accounts';

test.describe('improve-detection — Bank Accounts page structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BANK_ACCOUNTS_URL);
    await page.waitForLoadState('networkidle');
  });

  test('Bank Accounts page loads without error', async ({ page }) => {
    await expect(page).not.toHaveURL(/error/);
    await expect(
      page.getByRole('heading', { name: /bank accounts/i }),
    ).toBeVisible({ timeout: 5000 });
  });

  test('"Tracked" column header is present in the accounts table', async ({ page }) => {
    // The accounts table has column: Bank | Account Name | Transactions | Tracked | (delete)
    await expect(
      page.getByRole('columnheader', { name: /tracked/i }),
    ).toBeVisible({ timeout: 5000 });
  });

  test('seeded accounts are listed (E2E Test Checking or E2E Savings Account)', async ({
    page,
  }) => {
    // Multiple accounts may match — use count-based assertion (strict mode safe)
    const accountItems = page.getByText(/E2E Test Checking|E2E Savings Account/i);
    const count = await accountItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('isTracked toggle switch is visible for each account row', async ({ page }) => {
    // Each row has a <button role="switch"> for the Tracked column
    const toggles = page.getByRole('switch');
    const count = await toggles.count();
    expect(count).toBeGreaterThan(0);
  });

  test('toggle switch defaults to checked (isTracked=true)', async ({ page }) => {
    // Global-setup resets isTracked=true — all toggles should be aria-checked="true"
    const toggles = page.getByRole('switch');
    const count = await toggles.count();
    expect(count).toBeGreaterThan(0);

    // At least the first toggle is on (true)
    const firstToggle = toggles.first();
    const ariaChecked = await firstToggle.getAttribute('aria-checked');
    expect(ariaChecked).toBe('true');
  });
});

test.describe('improve-detection — isTracked toggle interaction', () => {
  // All tests in this block mutate E2E Savings Account — must run serially
  test.describe.configure({ mode: 'serial' });

  test('clicking toggle turns account off (isTracked=false)', async ({ page }) => {
    await page.goto(BANK_ACCOUNTS_URL);
    await page.waitForLoadState('networkidle');

    // Find E2E Savings Account row and its toggle
    const savingsRow = page
      .getByRole('row')
      .filter({ hasText: /E2E Savings Account/i });

    const toggle = savingsRow.getByRole('switch').first();
    await expect(toggle).toBeVisible({ timeout: 5000 });

    // Should start as checked
    expect(await toggle.getAttribute('aria-checked')).toBe('true');

    // Click to untrack
    await toggle.click();

    // Toast: "Account tracking updated"
    await expect(
      page.getByText(/account tracking updated/i).first(),
    ).toBeVisible({ timeout: 5000 });

    // Toggle should now be unchecked (off)
    await expect(toggle).toHaveAttribute('aria-checked', 'false', { timeout: 8000 });
  });

  test('toggling off then on restores isTracked=true', async ({ page }) => {
    await page.goto(BANK_ACCOUNTS_URL);
    await page.waitForLoadState('networkidle');

    const savingsRow = page
      .getByRole('row')
      .filter({ hasText: /E2E Savings Account/i });
    const toggle = savingsRow.getByRole('switch').first();
    await expect(toggle).toBeVisible({ timeout: 5000 });

    // Normalize: ensure toggle starts ON (prior test may have left it OFF)
    const currentState = await toggle.getAttribute('aria-checked');
    if (currentState === 'false') {
      await toggle.click();
      await expect(page.getByText(/account tracking updated/i).first()).toBeVisible({ timeout: 5000 });
      await expect(toggle).toHaveAttribute('aria-checked', 'true', { timeout: 8000 });
    }

    // Turn off
    await toggle.click();
    await expect(page.getByText(/account tracking updated/i).first()).toBeVisible({ timeout: 5000 });
    await expect(toggle).toHaveAttribute('aria-checked', 'false', { timeout: 8000 });

    // Turn back on
    await toggle.click();
    await expect(page.getByText(/account tracking updated/i).first()).toBeVisible({ timeout: 5000 });
    await expect(toggle).toHaveAttribute('aria-checked', 'true', { timeout: 8000 });
  });

  test('tracking state persists after page reload', async ({ page }) => {
    await page.goto(BANK_ACCOUNTS_URL);
    await page.waitForLoadState('networkidle');

    // Ensure E2E Savings Account row is present
    const savingsRow = page
      .getByRole('row')
      .filter({ hasText: /E2E Savings Account/i });
    await expect(savingsRow).toBeVisible({ timeout: 5000 });

    const toggle = savingsRow.getByRole('switch').first();
    await expect(toggle).toBeVisible({ timeout: 5000 });

    // Ensure we start from a known ON state (in case prior test left it OFF)
    const currentState = await toggle.getAttribute('aria-checked');
    if (currentState === 'false') {
      await toggle.click();
      await expect(page.getByText(/account tracking updated/i).first()).toBeVisible({ timeout: 5000 });
      await expect(toggle).toHaveAttribute('aria-checked', 'true', { timeout: 8000 });
    }

    // Untrack the account
    await toggle.click();
    await expect(page.getByText(/account tracking updated/i).first()).toBeVisible({ timeout: 5000 });
    await expect(toggle).toHaveAttribute('aria-checked', 'false', { timeout: 8000 });

    // Reload and verify the state persisted
    await page.goto(BANK_ACCOUNTS_URL);
    await page.waitForLoadState('networkidle');

    const reloadedRow = page
      .getByRole('row')
      .filter({ hasText: /E2E Savings Account/i });
    const reloadedToggle = reloadedRow.getByRole('switch').first();
    // After reload, should still be unchecked (persisted in DB)
    await expect(reloadedToggle).toHaveAttribute('aria-checked', 'false', { timeout: 5000 });

    // Restore state so downstream tests start clean
    await reloadedToggle.click();
    await expect(page.getByText(/account tracking updated/i).first()).toBeVisible({ timeout: 5000 });
    await expect(reloadedToggle).toHaveAttribute('aria-checked', 'true', { timeout: 8000 });
  });

  test('untracked toggle is aria-checked=false after turning it off', async ({ page }) => {
    await page.goto(BANK_ACCOUNTS_URL);
    await page.waitForLoadState('networkidle');

    const savingsRow = page
      .getByRole('row')
      .filter({ hasText: /E2E Savings Account/i });
    await expect(savingsRow).toBeVisible({ timeout: 5000 });
    const toggle = savingsRow.getByRole('switch').first();

    // Normalize: ensure toggle starts ON
    const currentState = await toggle.getAttribute('aria-checked');
    if (currentState === 'false') {
      await toggle.click();
      await expect(page.getByText(/account tracking updated/i).first()).toBeVisible({ timeout: 5000 });
      await expect(toggle).toHaveAttribute('aria-checked', 'true', { timeout: 8000 });
    }

    // Turn off
    await toggle.click();
    await expect(page.getByText(/account tracking updated/i).first()).toBeVisible({ timeout: 5000 });

    // After turning off, aria-checked should be false
    await expect(toggle).toHaveAttribute('aria-checked', 'false', { timeout: 8000 });

    // Restore for any downstream tests
    await toggle.click();
    await expect(page.getByText(/account tracking updated/i).first()).toBeVisible({ timeout: 5000 });
    await expect(toggle).toHaveAttribute('aria-checked', 'true', { timeout: 8000 });
  });
});

test.describe('improve-detection — isTracked toggle visual state', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BANK_ACCOUNTS_URL);
    await page.waitForLoadState('networkidle');
  });

  test('tracked toggle is aria-checked=true when account is tracked', async ({ page }) => {
    // E2E Test Checking is never toggled off in any test — guaranteed to be true
    const checkingRow = page
      .getByRole('row')
      .filter({ hasText: /E2E Test Checking/i });
    await expect(checkingRow).toBeVisible({ timeout: 5000 });
    const toggle = checkingRow.getByRole('switch').first();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
  });
});
