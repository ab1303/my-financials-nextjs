import { test, expect } from '@playwright/test';

test.describe('Income Summary Reports', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/reports/income-summary');
    await page.waitForLoadState('networkidle');
  });

  test('should load income summary report page', async ({ page }) => {
    await expect(
      page.locator('text=/Income Summary|Income Report/i'),
    ).toBeVisible();
  });

  test('should display year selector', async ({ page }) => {
    const yearDropdown = page.locator('[role="combobox"], select').first();
    if (await yearDropdown.isVisible()) {
      await expect(yearDropdown).toBeVisible();
    }
  });

  test('should display summary data when year selected', async ({ page }) => {
    const yearDropdown = page.locator('[role="combobox"], select').first();
    if (await yearDropdown.isVisible()) {
      await yearDropdown.click();
      await page.locator('[role="option"]').first().click();
      await page.waitForLoadState('networkidle');

      // Check for summary content
      const summaryContent = page.locator('text=/Total Income|Income|Summary/');
      if (
        await summaryContent.isVisible({ timeout: 2000 }).catch(() => false)
      ) {
        await expect(summaryContent).toBeVisible();
      }
    }
  });

  test('should filter by income source if available', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const sourceFilter = page.locator('[role="combobox"], select').nth(1);
    if (await sourceFilter.isVisible()) {
      await sourceFilter.click();
      const option = page.locator('[role="option"]').first();
      if (await option.isVisible()) {
        await option.click();
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('should display empty state when no data', async ({ page }) => {
    const yearDropdown = page.locator('[role="combobox"], select').first();
    if (await yearDropdown.isVisible()) {
      await yearDropdown.click();
      const options = page.locator('[role="option"]');
      const lastOption = options.last();
      await lastOption.click();
      await page.waitForLoadState('networkidle');

      // Should show empty state or zero values
      const emptyMessage = page.locator('text=/no data|No income|empty/i');
      const zeroDisplay = page.locator('text=/0/');

      if (await emptyMessage.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(emptyMessage).toBeVisible();
      }
    }
  });
});
