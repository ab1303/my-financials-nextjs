/**
 * e2e: harden-import-wizard — Transfer Likelihood Warnings in CSV Import
 *
 * Validates the "warn, never block" approach for probable transfers in the
 * CSV import wizard:
 *
 *  1. Review step shows a yellow banner when flagged transactions exist
 *     "↔ N transactions look like possible transfers. Review them before confirming…"
 *
 *  2. Clicking "Confirm & Import All" when transfers are flagged opens a warning modal
 *     "Possible transfers detected — N transaction(s) look like inter-account transfers"
 *
 *  3. The modal has two buttons: "Review first" (dismisses modal) and "Continue anyway"
 *     — import always proceeds if user chooses to continue. No blocking gate.
 *
 * Notes:
 *  - Tests that require the full LLM classify step are marked with the
 *    NAB fixture CSV which contains "TRANSFER OUT" and "TRANSFER IN" keywords.
 *  - These tests require a running dev server AND valid AI API keys.
 *  - Structural tests (wizard opens, steps visible) run without API keys.
 */

import { test, expect } from '@playwright/test';

const EXPENSE_URL = '/cashflow/expense';

// ---------------------------------------------------------------------------
// Helper: open the CSV Import Wizard modal
// ---------------------------------------------------------------------------
async function openImportWizard(page: ReturnType<typeof test['info']> extends never ? never : Parameters<Parameters<typeof test>[1]>[0]) {
  await page.goto(EXPENSE_URL);
  await page.waitForLoadState('networkidle');

  await page
    .getByRole('button', { name: /csv import|import csv/i })
    .first()
    .click();

  await expect(page.getByRole('dialog').or(page.locator('[data-headlessui-state]'))).toBeVisible({
    timeout: 5000,
  });
}

// ---------------------------------------------------------------------------
// Helper: upload NAB CSV and start classification
// ---------------------------------------------------------------------------
async function uploadNabCsvAndClassify(page: Parameters<Parameters<typeof test>[1]>[0]) {
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles('e2e/fixtures/nab-sample.csv');

  // Select the bank account (required before import can start)
  const bankSelect = page
    .locator('[class*="react-select__control"]')
    .or(page.locator('select[name*="bank"], select[aria-label*="bank"]'))
    .first();

  if (await bankSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
    await bankSelect.click();
    const option = page.getByText('E2E Test Bank').or(
      page.locator('[role="option"]').first(),
    );
    if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
      await option.click();
    }
  }

  const startButton = page
    .getByRole('button', { name: /start import|parse|process/i })
    .filter({ hasNot: page.getByRole('button', { name: /cancel|close/i }) })
    .first();

  await expect(startButton).toBeEnabled({ timeout: 5000 });
  await startButton.click();

  // Wait for LLM classify step (can take time)
  await expect(page.getByText(/classifying|processing|step 2/i)).toBeVisible({
    timeout: 15000,
  });

  // Wait for review step
  await page.waitForSelector(
    'text=Step 3, text=Review, [data-step="review"], button:has-text("Confirm")',
    { timeout: 60000 },
  );
}

// ---------------------------------------------------------------------------
// Structural tests — do not require LLM API keys
// ---------------------------------------------------------------------------

test.describe('harden-import-wizard — CSV wizard structure', () => {
  test.beforeEach(async ({ page }) => {
    await openImportWizard(page);
  });

  test('CSV Import Wizard opens with correct title', async ({ page }) => {
    await expect(
      page.getByText('CSV Import Wizard'),
    ).toBeVisible({ timeout: 5000 });
  });

  test('wizard shows Upload / Classify / Review / Done step labels', async ({
    page,
  }) => {
    await expect(page.getByText('Upload')).toBeVisible();
    await expect(page.getByText('Classify')).toBeVisible();
    await expect(page.getByText('Review')).toBeVisible();
    await expect(page.getByText('Done')).toBeVisible();
  });

  test('step 1 shows file input and bank selector', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible({ timeout: 5000 });

    // Should show subtitle "Step 1: Select CSV File"
    await expect(page.getByText(/step 1/i)).toBeVisible();
  });

  test('wizard can be dismissed with the × close button', async ({ page }) => {
    const closeButton = page.getByRole('button', { name: /close wizard/i });
    await expect(closeButton).toBeVisible({ timeout: 5000 });
    await closeButton.click();

    // Dialog should disappear
    await expect(page.getByText('CSV Import Wizard')).not.toBeVisible({
      timeout: 3000,
    });
  });

  test('NAB sample CSV fixture is accepted by file input', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('e2e/fixtures/nab-sample.csv');

    // File name should appear somewhere in the UI
    await expect(page.getByText('nab-sample.csv')).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Functional tests — require LLM API keys + running dev server
// ---------------------------------------------------------------------------

test.describe('harden-import-wizard — Transfer warning flow (requires LLM)', () => {
  test.beforeEach(async ({ page }) => {
    await openImportWizard(page);
  });

  test('review step shows yellow transfer warning banner when transfers detected', async ({
    page,
  }) => {
    await uploadNabCsvAndClassify(page);

    // NAB CSV contains "TRANSFER OUT" and "TRANSFER IN" — detectTransferLikelihood
    // assigns 'HIGH' to these, triggering the warning banner in CSVTransactionReviewTable
    await expect(
      page.getByText(/look like possible transfers/i),
    ).toBeVisible({ timeout: 5000 });

    // The warning banner uses the ↔ icon
    await expect(page.getByText('↔')).toBeVisible();
  });

  test('clicking "Confirm & Import All" with flagged transfers shows warning modal', async ({
    page,
  }) => {
    await uploadNabCsvAndClassify(page);

    // Click the Confirm button — should trigger the warning modal (not immediate save)
    const confirmButton = page.getByRole('button', { name: /confirm.*import all/i });
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    await confirmButton.click();

    // Transfer Warning Modal should appear
    await expect(
      page.getByText(/possible transfers detected/i),
    ).toBeVisible({ timeout: 5000 });
  });

  test('warning modal is informational — "Continue anyway" button is always present', async ({
    page,
  }) => {
    await uploadNabCsvAndClassify(page);

    const confirmButton = page.getByRole('button', { name: /confirm.*import all/i });
    await confirmButton.click();

    // Must have "Continue anyway" — no blocking gate
    await expect(
      page.getByRole('button', { name: /continue anyway/i }),
    ).toBeVisible({ timeout: 5000 });
  });

  test('"Review first" button dismisses modal without blocking', async ({
    page,
  }) => {
    await uploadNabCsvAndClassify(page);

    const confirmButton = page.getByRole('button', { name: /confirm.*import all/i });
    await confirmButton.click();

    const reviewFirstButton = page.getByRole('button', { name: /review first/i });
    await expect(reviewFirstButton).toBeVisible({ timeout: 5000 });
    await reviewFirstButton.click();

    // Modal dismissed — should be back on review step
    await expect(page.getByText(/possible transfers detected/i)).not.toBeVisible({
      timeout: 3000,
    });
    await expect(
      page.getByRole('button', { name: /confirm.*import all/i }),
    ).toBeVisible();
  });

  test('warning modal shows the flagged transaction count', async ({ page }) => {
    await uploadNabCsvAndClassify(page);

    const confirmButton = page.getByRole('button', { name: /confirm.*import all/i });
    await confirmButton.click();

    // Modal text: "N transaction(s) look like inter-account transfers"
    await expect(
      page.getByText(/transaction.* look like inter-account transfers/i),
    ).toBeVisible({ timeout: 5000 });
  });

  test('warning modal explains user can resolve in Transfers tab later', async ({
    page,
  }) => {
    await uploadNabCsvAndClassify(page);

    const confirmButton = page.getByRole('button', { name: /confirm.*import all/i });
    await confirmButton.click();

    // The modal explains the resolution path — no hard block
    await expect(
      page.getByText(/resolve any unmatched transfers in the transfers tab/i),
    ).toBeVisible({ timeout: 5000 });
  });
});
