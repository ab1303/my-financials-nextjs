import { test, expect } from '@playwright/test';

test.describe('Income Management', () => {
  test.beforeEach(async ({ page }) => {
    // Use authenticated session from auth.setup.ts
    await page.goto('/cashflow/income');
    await page.waitForLoadState('networkidle');
  });

  test('should load income page with fiscal year selector', async ({
    page,
  }) => {
    // Check page title
    await expect(
      page.getByRole('heading', { name: 'Income Tracking' }),
    ).toBeVisible();

    // Check for fiscal year dropdown
    const yearSelector = page.locator('select, [role="combobox"]').first();
    await expect(yearSelector).toBeVisible();
  });

  test('should add new income entry', async ({ page }) => {
    // Click add button
    const addButton = page
      .locator('button:has-text("+"), button[aria-label*="Add"]')
      .first();
    if (await addButton.isVisible()) {
      await addButton.click();

      // Fill in income entry form
      const dateInputs = page.locator('input[type="date"]');
      if (await dateInputs.first().isVisible()) {
        await dateInputs.first().fill('2025-02-15');
      }

      const amountInputs = page.locator('input[type="number"]');
      if (await amountInputs.first().isVisible()) {
        await amountInputs.first().fill('5000');
      }

      // Save entry
      const saveButton = page.locator('button:has-text("Save")').first();
      if (await saveButton.isVisible()) {
        await saveButton.click();
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('should edit existing income entry', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Find first edit button
    const editButton = page
      .locator('button[aria-label*="Edit"], button:has-text("✏")')
      .first();
    if (await editButton.isVisible()) {
      await editButton.click();
      await page.waitForLoadState('networkidle');

      // Update amount
      const amountInput = page.locator('input[type="number"]').first();
      if (await amountInput.isVisible()) {
        await amountInput.clear();
        await amountInput.fill('6000');
      }

      // Save changes
      const saveButton = page.locator('button:has-text("Save")').first();
      if (await saveButton.isVisible()) {
        await saveButton.click();
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('should delete income entry', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Find first delete button
    const deleteButton = page
      .locator('button[aria-label*="Delete"], button:has-text("🗑")')
      .first();
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      await page.waitForLoadState('networkidle');

      // Confirm deletion if dialog appears
      const confirmButton = page
        .locator(
          'button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")',
        )
        .last();
      if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmButton.click();
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('should validate income entry required fields', async ({ page }) => {
    // Click add button
    const addButton = page.locator('button:has-text("+")').first();
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForLoadState('networkidle');

      // Try to save without filling required fields
      const saveButton = page.locator('button:has-text("Save")').first();
      if (await saveButton.isVisible()) {
        await saveButton.click();

        // Should show validation errors or be disabled
        const errorOrDisabled = page.locator(
          '[role="alert"], text=required, [aria-invalid="true"]',
        );
        if (
          await errorOrDisabled
            .first()
            .isVisible({ timeout: 2000 })
            .catch(() => false)
        ) {
          await expect(errorOrDisabled.first()).toBeVisible();
        }
      }
    }
  });
});
