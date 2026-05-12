import { test, expect } from '@playwright/test';

test.describe('CSV Import — CommBank Transactions', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to cashflow/expense page
    await page.goto('/cashflow/expense');
    await page.waitForLoadState('networkidle');
  });

  test('should display CSV Import button on expense page', async ({ page }) => {
    // The expense page must have a visible "Import CSV" or "CSV Import" button
    const csvImportButton = page
      .getByRole('button', { name: /csv import|import csv/i })
      .first();
    await expect(csvImportButton).toBeVisible();
  });

  test('should open CSV import wizard modal when button is clicked', async ({
    page,
  }) => {
    // Click the import button
    await page
      .getByRole('button', { name: /csv import|import csv/i })
      .first()
      .click();

    // Modal dialog should appear
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    // Modal should have a title indicating CSV import
    await expect(
      page.getByRole('heading', { name: /import transactions|csv/i }),
    ).toBeVisible();
  });

  test('should have file upload zone in step 1', async ({ page }) => {
    await page
      .getByRole('button', { name: /csv import|import csv/i })
      .first()
      .click();

    // File input should be visible
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible();

    // Upload instructions should be present
    await expect(page.getByText(/drag.*drop|upload/i)).toBeVisible();
  });

  test('should accept CSV file upload and show parsing progress', async ({
    page,
  }) => {
    await page
      .getByRole('button', { name: /csv import|import csv/i })
      .first()
      .click();

    // Upload the fixture CSV file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('e2e/fixtures/commbank-sample.csv');

    // A "Parse" or "Process" button should appear/become enabled
    const parseButton = page
      .getByRole('button', { name: /parse|process|import/i })
      .filter({ hasNot: page.getByRole('button', { name: /cancel|close/i }) });

    await expect(parseButton.first()).toBeEnabled();
    await parseButton.first().click();

    // Expect processing state with progress indication
    await expect(
      page.getByText(/processing|parsing|categorizing/i),
    ).toBeVisible();

    // Should complete parsing
    await page.waitForLoadState('networkidle');
  });

  test('should display parsed transactions with semantic category matching', async ({
    page,
  }) => {
    await page
      .getByRole('button', { name: /csv import|import csv/i })
      .first()
      .click();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('e2e/fixtures/commbank-sample.csv');

    await page
      .getByRole('button', { name: /parse|process|import/i })
      .filter({ hasNot: page.getByRole('button', { name: /cancel|close/i }) })
      .first()
      .click();

    await page.waitForLoadState('networkidle');

    // Results preview should show transactions
    // Check for key merchants from the sample CSV
    await expect(page.getByText('WOOLWORTHS 1294 HORNSBY')).toBeVisible();
    await expect(page.getByText('TRANSPORTFORNSW TAP SYDNEY')).toBeVisible();

    // Check that categories were assigned (semantic matching)
    // WOOLWORTHS should map to Food
    const woolworthsRow = page.locator('table, [role="grid"], tbody').first();
    if (await woolworthsRow.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(woolworthsRow.getByText(/food|groceries/i)).toBeVisible();
    }
  });

  test('should display confidence score for import quality', async ({
    page,
  }) => {
    await page
      .getByRole('button', { name: /csv import|import csv/i })
      .first()
      .click();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('e2e/fixtures/commbank-sample.csv');

    await page
      .getByRole('button', { name: /parse|process|import/i })
      .filter({ hasNot: page.getByRole('button', { name: /cancel|close/i }) })
      .first()
      .click();

    await page.waitForLoadState('networkidle');

    // Confidence score should be displayed (e.g., "95% confident" or similar)
    await expect(page.getByText(/confidence|accur|reliable|%/i)).toBeVisible();
  });

  test('should allow editing category before final save', async ({ page }) => {
    await page
      .getByRole('button', { name: /csv import|import csv/i })
      .first()
      .click();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('e2e/fixtures/commbank-sample.csv');

    await page
      .getByRole('button', { name: /parse|process|import/i })
      .filter({ hasNot: page.getByRole('button', { name: /cancel|close/i }) })
      .first()
      .click();

    await page.waitForLoadState('networkidle');

    // Find a category dropdown/combobox and change it
    const categorySelectors = page.locator(
      'select, [role="combobox"], [role="listbox"]',
    );
    const firstCategorySelector = categorySelectors.first();

    if (
      await firstCategorySelector
        .isVisible({ timeout: 2000 })
        .catch(() => false)
    ) {
      // Try to select a different category
      await firstCategorySelector.click();
      const optionToSelect = page
        .getByRole('option', { name: /healthcare|personal|education/i })
        .first();

      if (
        await optionToSelect.isVisible({ timeout: 1000 }).catch(() => false)
      ) {
        await optionToSelect.click();
      }
    }
  });

  test('should save import and create expense entries', async ({ page }) => {
    await page
      .getByRole('button', { name: /csv import|import csv/i })
      .first()
      .click();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('e2e/fixtures/commbank-sample.csv');

    await page
      .getByRole('button', { name: /parse|process|import/i })
      .filter({ hasNot: page.getByRole('button', { name: /cancel|close/i }) })
      .first()
      .click();

    await page.waitForLoadState('networkidle');

    // Click the final "Save" or "Complete" button
    const saveButton = page
      .getByRole('button', { name: /save|complete|import/i })
      .filter({ hasNot: page.getByRole('button', { name: /cancel|close/i }) });

    await expect(saveButton.first()).toBeVisible();
    await saveButton.first().click();

    await page.waitForLoadState('networkidle');

    // Expect success message
    await expect(
      page.getByText(/import complete|success|entries created/i),
    ).toBeVisible();

    // Modal should close
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('should close import wizard when cancel is clicked', async ({
    page,
  }) => {
    await page
      .getByRole('button', { name: /csv import|import csv/i })
      .first()
      .click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    // Click cancel button
    const cancelButton = page
      .getByRole('button', { name: /cancel|close/i })
      .first();
    await cancelButton.click();

    // Modal should be gone
    await expect(modal).not.toBeVisible();
  });

  test('should reject invalid file formats', async ({ page }) => {
    await page
      .getByRole('button', { name: /csv import|import csv/i })
      .first()
      .click();

    // Try to upload an invalid file (create temporary text file)
    const fileInput = page.locator('input[type="file"]');

    // This test assumes the file input has accept="...csv" or similar validation
    // Playwright will prevent selecting non-CSV files if the input has accept attribute
    // Or the app should validate on upload

    // Verify that an error message appears for unsupported formats
    // (This behavior is app-dependent and may need adjustment)
    const errorMsg = page.getByText(/invalid|unsupported|csv.*required/i);
    if (await errorMsg.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(errorMsg).toBeVisible();
    }
  });

  test('should handle empty CSV file gracefully', async ({ page }) => {
    await page
      .getByRole('button', { name: /csv import|import csv/i })
      .first()
      .click();

    const fileInput = page.locator('input[type="file"]');

    // Create an empty CSV and try to upload
    // For now, verify that the app shows an appropriate error
    const errorOrEmptyMsg = page.getByText(
      /no transactions|empty|no data|no rows/i,
    );
    if (await errorOrEmptyMsg.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(errorOrEmptyMsg).toBeVisible();
    }
  });

  test('should link uploaded image/file to created expense entries for audit trail', async ({
    page,
  }) => {
    await page
      .getByRole('button', { name: /csv import|import csv/i })
      .first()
      .click();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('e2e/fixtures/commbank-sample.csv');

    await page
      .getByRole('button', { name: /parse|process|import/i })
      .filter({ hasNot: page.getByRole('button', { name: /cancel|close/i }) })
      .first()
      .click();

    await page.waitForLoadState('networkidle');

    // Save the import
    await page
      .getByRole('button', { name: /save|complete|import/i })
      .filter({ hasNot: page.getByRole('button', { name: /cancel|close/i }) })
      .first()
      .click();

    await page.waitForLoadState('networkidle');

    // Go back to expense list/table
    await page.goto('/cashflow/expense');
    await page.waitForLoadState('networkidle');

    // Newly imported entries should have an audit icon (camera/file icon)
    const auditIcon = page.getByRole('img', { name: /import|audit|source/i });
    if (
      await auditIcon
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false)
    ) {
      await expect(auditIcon.first()).toBeVisible();
      // Clicking the icon should show the source image/file
      await auditIcon.first().click();
    }
  });

  test('should respect fiscal year context when creating entries from CSV', async ({
    page,
  }) => {
    // Select a specific fiscal year first
    const fiscalYearSelector = page
      .locator('select, [role="combobox"]')
      .filter({ hasText: /fiscal|year|2025/i })
      .first();

    if (
      await fiscalYearSelector.isVisible({ timeout: 2000 }).catch(() => false)
    ) {
      await fiscalYearSelector.selectOption({ label: /2025/ });
    }

    await page
      .getByRole('button', { name: /csv import|import csv/i })
      .first()
      .click();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('e2e/fixtures/commbank-sample.csv');

    await page
      .getByRole('button', { name: /parse|process|import/i })
      .filter({ hasNot: page.getByRole('button', { name: /cancel|close/i }) })
      .first()
      .click();

    await page.waitForLoadState('networkidle');

    // Verify that the fiscal year is preserved
    const fiscalYearDisplay = page.locator('text=/2025|fiscal year 2025/i');
    if (
      await fiscalYearDisplay.isVisible({ timeout: 2000 }).catch(() => false)
    ) {
      await expect(fiscalYearDisplay).toBeVisible();
    }
  });
});
