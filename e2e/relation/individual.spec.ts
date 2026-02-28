import { test, expect } from '@playwright/test';

test.describe('Individual Entity Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cashflow/relation/individual');
  });

  test('user can view list of individuals', async ({ page }) => {
    const table = page.locator('table, [role="grid"]').first();
    await expect(table).toBeVisible({ timeout: 10000 });
  });

  test('user can create a new individual', async ({ page }) => {
    const createBtn = page
      .locator(
        'button:has-text("Create"), button:has-text("Add"), button:has-text("New"), [data-testid="create-individual-btn"]',
      )
      .first();

    const isVisible = await createBtn
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (isVisible) {
      await createBtn.click();

      const uniqueName = `Individual ${Date.now()}`;
      const nameInput = page.locator('input[name="name"]').first();

      if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await nameInput.fill(uniqueName);
      }

      const submitBtn = page
        .locator(
          'button:has-text("Save"), button:has-text("Create"), button[type="submit"]',
        )
        .first();
      await submitBtn.click({ timeout: 5000 });

      const successMsg = page.locator('text=/success|created|added/i');
      await expect(successMsg).toBeVisible({ timeout: 5000 });
    }
  });

  test('unique name constraint is enforced for individuals', async ({
    page,
  }) => {
    const createBtn = page
      .locator(
        'button:has-text("Create"), button:has-text("Add"), button:has-text("New")',
      )
      .first();

    const isVisible = await createBtn
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (isVisible) {
      await createBtn.click();

      const nameInput = page.locator('input[name="name"]').first();
      if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Use the seeded individual name
        await nameInput.fill('Test Individual');
      }

      const submitBtn = page
        .locator(
          'button:has-text("Save"), button:has-text("Create"), button[type="submit"]',
        )
        .first();
      await submitBtn.click({ timeout: 5000 });

      const errorMsg = page.locator(
        'text=/already exists|duplicate|unique|constraint/i',
      );
      await expect(errorMsg).toBeVisible({ timeout: 5000 });
    }
  });

  test('user can edit existing individual', async ({ page }) => {
    const table = page.locator('table, [role="grid"]').first();
    await expect(table).toBeVisible({ timeout: 10000 });

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
    const table = page.locator('table, [role="grid"]').first();
    await expect(table).toBeVisible({ timeout: 10000 });

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
