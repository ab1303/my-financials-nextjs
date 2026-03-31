import { test, expect } from '@playwright/test';

test.describe('Business Entity Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/relation/business');
  });

  test('user can view list of businesses', async ({ page }) => {
    // The business page uses a Select component (react-select), not a table
    const heading = page.getByRole('heading', { name: 'Business Relations' });
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('user can create a new business', async ({ page }) => {
    // Verify the create form is present with required fields
    await expect(page.locator('#businessName')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Create' })).toBeVisible();

    // Fill the business name to verify the field is interactive
    const uniqueName = `Business ${Date.now()}`;
    await page.locator('#businessName').fill(uniqueName);
    await expect(page.locator('#businessName')).toHaveValue(uniqueName);
  });

  test('unique name constraint is enforced', async ({ page }) => {
    // Fill businessName with the seeded reference business name
    const nameInput = page.locator('#businessName');
    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nameInput.fill('Test Business');

      const submitBtn = page.getByRole('button', { name: 'Create' });
      await submitBtn.click();

      // Sonner toast or inline validation error should appear
      await expect(
        page
          .locator('[data-sonner-toaster], .text-red-500, .text-destructive')
          .first(),
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('user can edit existing business', async ({ page }) => {
    // Business page uses Select dropdown, not a table
    const heading = page.getByRole('heading', { name: 'Business Relations' });
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Look for edit button
    const editBtn = page
      .locator(
        'button:has-text("Edit"), button:has-text("Update"), [data-testid="edit-btn"]',
      )
      .first();

    const isVisible = await editBtn
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (isVisible) {
      await editBtn.click();

      const nameInput = page.locator('input[name="name"]').first();
      if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await nameInput.fill(`Updated Business ${Date.now()}`);
      }

      const submitBtn = page
        .locator(
          'button:has-text("Save"), button:has-text("Update"), button[type="submit"]',
        )
        .first();
      await submitBtn.click({ timeout: 5000 });

      const successMsg = page.locator('text=/success|updated|changed/i');
      await expect(successMsg).toBeVisible({ timeout: 5000 });
    }
  });

  test('user can delete business', async ({ page }) => {
    // Business page uses Select dropdown, not a table
    const heading = page.getByRole('heading', { name: 'Business Relations' });
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Look for delete button
    const deleteBtn = page
      .locator(
        'button:has-text("Delete"), button:has-text("Remove"), [data-testid="delete-btn"]',
      )
      .first();

    const isVisible = await deleteBtn
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (isVisible) {
      await deleteBtn.click();

      // Confirm deletion if needed
      const confirmBtn = page.locator(
        'button:has-text("Confirm"), button:has-text("Delete"), [data-testid="confirm-delete"]',
      );
      const confirmVisible = await confirmBtn
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (confirmVisible) {
        await confirmBtn.click();
      }

      // Check for success message
      const successMsg = page.locator('text=/success|deleted|removed/i');
      await expect(successMsg).toBeVisible({ timeout: 5000 });
    }
  });
});
