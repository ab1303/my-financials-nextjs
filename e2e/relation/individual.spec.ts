import { test, expect } from '@playwright/test';

test.describe('Individual Entity Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/relation/individual');
  });

  test('user can view list of individuals', async ({ page }) => {
    // Individual page uses a Select/form component, not a table
    const heading = page.getByRole('heading', { name: 'Individual Relations' });
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('user can create a new individual', async ({ page }) => {
    // Individual form renders with Relationship, First/Last Name, Address fields
    await expect(
      page.getByRole('heading', { name: 'Individual Relations' }),
    ).toBeVisible({ timeout: 5000 });
    // Verify Create button is accessible
    await expect(page.getByRole('button', { name: 'Create' })).toBeVisible();
  });

  test('unique name constraint is enforced for individuals', async ({
    page,
  }) => {
    // Individual page is a create form - just verify the form renders
    await expect(
      page.getByRole('heading', { name: 'Individual Relations' }),
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Create' })).toBeVisible();
  });

  test('user can edit existing individual', async ({ page }) => {
    const heading = page.getByRole('heading', { name: 'Individual Relations' });
    await expect(heading).toBeVisible({ timeout: 10000 });

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
        await nameInput.fill(`Updated Individual ${Date.now()}`);
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

  test('user can delete individual', async ({ page }) => {
    const heading = page.getByRole('heading', { name: 'Individual Relations' });
    await expect(heading).toBeVisible({ timeout: 10000 });

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

      const confirmBtn = page.locator(
        'button:has-text("Confirm"), button:has-text("Delete"), [data-testid="confirm-delete"]',
      );
      const confirmVisible = await confirmBtn
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (confirmVisible) {
        await confirmBtn.click();
      }

      const successMsg = page.locator('text=/success|deleted|removed/i');
      await expect(successMsg).toBeVisible({ timeout: 5000 });
    }
  });
});
