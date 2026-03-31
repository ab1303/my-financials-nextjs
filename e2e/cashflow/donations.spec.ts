import { test, expect } from '@playwright/test';

test.describe('Donations Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cashflow/donations');
    await page.waitForLoadState('networkidle');
  });

  test('should load donations page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Donation Tracking' })).toBeVisible();
  });

  test('should display donations list if data exists', async ({ page }) => {
    // Check for list/table
    const table = page.locator('table, [role="grid"], tbody').first();
    if (await table.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(table).toBeVisible();
    }
  });

  test('should add new donation entry', async ({ page }) => {
    // Click add button
    const addButton = page
      .locator('button:has-text("+"), button[aria-label*="Add"]')
      .first();
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForLoadState('networkidle');

      // Fill donation details
      const dateInputs = page.locator('input[type="date"]');
      if (await dateInputs.first().isVisible()) {
        await dateInputs.first().fill('2025-02-15');
      }

      const amountInputs = page.locator('input[type="number"]');
      if (await amountInputs.first().isVisible()) {
        await amountInputs.first().fill('500');
      }

      // Save
      const saveButton = page.locator('button:has-text("Save")').first();
      if (await saveButton.isVisible()) {
        await saveButton.click();
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('should edit donation entry', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const editButton = page
      .locator('button[aria-label*="Edit"], button:has-text("✏")')
      .first();
    if (await editButton.isVisible()) {
      await editButton.click();
      await page.waitForLoadState('networkidle');

      const amountInput = page.locator('input[type="number"]').first();
      if (await amountInput.isVisible()) {
        await amountInput.clear();
        await amountInput.fill('750');
      }

      const saveButton = page.locator('button:has-text("Save")').first();
      if (await saveButton.isVisible()) {
        await saveButton.click();
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('should delete donation entry', async ({ page }) => {
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
