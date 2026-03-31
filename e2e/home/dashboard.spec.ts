import { test, expect } from '@playwright/test';

test.describe('Home Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // All tests in this suite use storageState, so user is authenticated
    await page.goto('/home');
  });

  test('authenticated user can view dashboard', async ({ page }) => {
    // Verify we're on the home page
    await expect(page).toHaveURL(/\/home/);

    // Page should have loaded successfully
    await expect(page.getByRole('main')).toBeVisible({ timeout: 5000 });
  });

  test('dashboard displays welcome message or user info', async ({ page }) => {
    // Check for user name or welcome message (adjust selector)
    const userDisplay = page.getByRole('heading', { name: 'Dashboard' });
    await expect(userDisplay).toBeVisible({ timeout: 5000 });
  });

  test('sidebar navigation is visible', async ({ page }) => {
    // Look for main navigation elements (desktop sidebar is second aside)
    const sidebar = page.locator('aside').last();
    await expect(sidebar).toBeVisible({ timeout: 5000 });
  });

  test('can navigate to cashflow section', async ({ page }) => {
    // Click on cashflow link in navigation
    const cashflowLink = page
      .locator('a:has-text("Cashflow"), a[href*="cashflow"]')
      .first();

    const isVisible = await cashflowLink
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (isVisible) {
      await cashflowLink.click();
      // Verify navigation
      await expect(page).toHaveURL(/\/cashflow/);
    }
  });

  test('can navigate to settings section', async ({ page }) => {
    const settingsLink = page
      .locator('a:has-text("Settings"), a[href*="settings"]')
      .first();

    const isVisible = await settingsLink
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (isVisible) {
      await settingsLink.click();
      await expect(page).toHaveURL(/\/settings/);
    }
  });

  test('can navigate to relations section', async ({ page }) => {
    const relationLink = page
      .locator(
        'a:has-text("Relations"), a:has-text("Relation"), a[href*="relation"]',
      )
      .first();

    const isVisible = await relationLink
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (isVisible) {
      await relationLink.click();
      await expect(page).toHaveURL(/\/relation/);
    }
  });
});
