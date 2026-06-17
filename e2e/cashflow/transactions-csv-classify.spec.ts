import { test, expect } from '@playwright/test';

/**
 * Transactions page — CSV Import Classification
 *
 * Covers the bug scenario: "Classification failed: Invalid request body"
 * which was caused by ClassifyRequestSchema requiring calendarId
 * but the client only sending fileId.
 *
 * Note: Tests that require triggering react-dropzone file upload programmatically
 * are not included here (Chrome security prevents untrusted DataTransfer events).
 * The full upload → classify → review flow is covered by csv-import-review.spec.ts.
 */
test.describe('Transactions CSV Import — Classification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cashflow/transactions');
    await page.waitForLoadState('networkidle');
  });

  test('should display the Transactions page with import options', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /transactions/i })).toBeVisible();
    // CSV Import card button must be present
    await expect(page.getByTestId('open-csv-import-wizard')).toBeVisible();
  });

  test('should open CSV Import Wizard when CSV card is clicked', async ({ page }) => {
    await page.getByTestId('open-csv-import-wizard').click();

    const dialog = page.getByTestId('csv-import-wizard');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Upload step (step 1) components should be present
    await expect(page.getByTestId('csv-dropzone')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('csv-bank-account-select')).toBeVisible({ timeout: 5000 });
  });

  test('should not show Import CSV button until a file has been uploaded', async ({ page }) => {
    await page.getByTestId('open-csv-import-wizard').click();

    const dialog = page.getByTestId('csv-import-wizard');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // The Import CSV button only renders AFTER a file is uploaded — verify it's absent initially
    await expect(page.getByTestId('csv-import-button')).not.toBeVisible();
    // Dropzone should be visible (waiting for file)
    await expect(page.getByTestId('csv-dropzone')).toBeVisible();
  });

  test('classify API should accept fileId without calendarId (regression: Invalid request body)', async ({ page }) => {
    // Regression test for: ClassifyRequestSchema previously required calendarId,
    // which caused the client (sending only fileId) to receive 400 "Invalid request body".
    //
    // Fix: calendarId must NOT be required — fileId alone is valid input.
    // Test: send { fileId } only and assert status is NOT 400.
    // A 404/500 for a non-existent fileId is acceptable — it means schema validation passed.
    const response = await page.request.post('/api/transactions/csv/classify', {
      headers: { 'Content-Type': 'application/json' },
      data: { fileId: 'test-schema-validation-only' },
    });

    // 400 = "Invalid request body" — schema validation failure (the regression)
    expect(response.status()).not.toBe(400);
  });
});
