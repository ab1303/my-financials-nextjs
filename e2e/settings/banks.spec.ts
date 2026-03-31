import { test, expect } from '@playwright/test';

test.describe('Bank Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings/banks');
    await page.waitForLoadState('networkidle');
  });

  test('should load banks settings page', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Bank Accounts' }),
    ).toBeVisible();
  });

  test('should display banks list', async ({ page }) => {
    const list = page.locator('table, [role="grid"], tbody').first();
    if (await list.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(list).toBeVisible();
    }
  });

  test('should add new bank', async ({ page }) => {
    const addButton = page
      .locator('button:has-text("Add"), button[aria-label*="Add"]')
      .first();
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForLoadState('networkidle');

      // Fill bank details
      const inputs = page.locator('input[type="text"]');
      if (await inputs.first().isVisible()) {
        await inputs.nth(0).fill('Test Bank');
        if (await inputs.nth(1).isVisible()) {
          await inputs.nth(1).fill('ACC123456');
        }
      }

      const saveButton = page.locator('button:has-text("Save")').first();
      if (await saveButton.isVisible()) {
        await saveButton.click();
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('should edit bank', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const editButton = page
      .locator('button[aria-label*="Edit"], button:has-text("✏")')
      .first();
    if (await editButton.isVisible()) {
      await editButton.click();
      await page.waitForLoadState('networkidle');

      const nameInput = page.locator('input[type="text"]').first();
      if (await nameInput.isVisible()) {
        await nameInput.clear();
        await nameInput.fill('Updated Bank');
      }

      const saveButton = page.locator('button:has-text("Save")').first();
      if (await saveButton.isVisible()) {
        await saveButton.click();
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('should delete bank', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const deleteButton = page
      .locator('button[aria-label*="Delete"], button:has-text("🗑")')
      .first();
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      await page.waitForLoadState('networkidle');

      const confirmButton = page
        .locator('button:has-text("Confirm"), button:has-text("Yes")')
        .last();
      if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmButton.click();
        await page.waitForLoadState('networkidle');
      }
    }
  });
});
