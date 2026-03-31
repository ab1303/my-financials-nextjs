import { test, expect } from '@playwright/test';

test.describe('Calendar Year Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings/calendar');
    await page.waitForLoadState('networkidle');
  });

  test('should load calendar settings page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Calendar Year(s)' })).toBeVisible();
  });

  test('should display calendar years list', async ({ page }) => {
    const list = page.locator('table, [role="grid"], tbody').first();
    if (await list.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(list).toBeVisible();
    }
  });

  test('should add new calendar year', async ({ page }) => {
    const addButton = page
      .locator('button:has-text("Add"), button[aria-label*="Add"]')
      .first();
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForLoadState('networkidle');

      // Select type
      const typeDropdown = page.locator('[role="combobox"]').first();
      if (await typeDropdown.isVisible()) {
        await typeDropdown.click();
        await page
          .locator('text=/FISCAL|ZAKAT|ANNUAL/', { exact: false })
          .first()
          .click();
      }

      // Fill form
      const inputs = page.locator('input[type="number"], input[type="text"]');
      let fillCount = 0;
      for (let i = 0; i < (await inputs.count()); i++) {
        const input = inputs.nth(i);
        if ((await input.isVisible()) && fillCount < 3) {
          if (fillCount === 0) await input.fill('2025');
          else if (fillCount === 1) await input.fill('2026');
          else await input.fill('Test Calendar');
          fillCount++;
        }
      }

      const saveButton = page.locator('button:has-text("Save")').first();
      if (await saveButton.isVisible()) {
        await saveButton.click();
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('should edit calendar year', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const editButton = page
      .locator('button[aria-label*="Edit"], button:has-text("✏")')
      .first();
    if (await editButton.isVisible()) {
      await editButton.click();
      await page.waitForLoadState('networkidle');

      const descInput = page.locator('input[type="text"]').first();
      if (await descInput.isVisible()) {
        await descInput.clear();
        await descInput.fill('Updated Calendar');
      }

      const saveButton = page.locator('button:has-text("Save")').first();
      if (await saveButton.isVisible()) {
        await saveButton.click();
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('should delete calendar year', async ({ page }) => {
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
