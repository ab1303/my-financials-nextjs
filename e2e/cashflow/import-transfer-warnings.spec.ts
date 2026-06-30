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

import { expect,test } from '@playwright/test';

import { dropFileOnZone } from '../helpers/drop-file';

// ---------------------------------------------------------------------------
// Helper: open the CSV Import Wizard modal
// ---------------------------------------------------------------------------
async function openImportWizard(page: Parameters<Parameters<typeof test>[1]>[0]) {
  await page.goto('/cashflow/transactions');
  await page.waitForLoadState('networkidle');
  await page.getByTestId('open-csv-import-wizard').click();
  await expect(page.getByTestId('csv-import-wizard')).toBeVisible({ timeout: 8000 });
}

// ---------------------------------------------------------------------------
// Helper: upload NAB CSV and start classification
// ---------------------------------------------------------------------------
async function uploadNabCsvAndClassify(page: Parameters<Parameters<typeof test>[1]>[0]) {
  // Must select bank account BEFORE dropping file (react-dropzone validates it in onDrop)
  const bankSelect = page.getByTestId('csv-bank-account-select');
  if (await bankSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
    const options = await bankSelect.locator('option').all();
    for (const opt of options) {
      const val = await opt.getAttribute('value');
      if (val && val.length > 0) { await bankSelect.selectOption(val); break; }
    }
  }

  // Use dropFileOnZone so react-dropzone's onDrop fires (not just input onChange)
  await dropFileOnZone(page, 'csv-dropzone', 'e2e/fixtures/nab-sample.csv');

  // Click the stable Import CSV button (appears after file upload API responds)
  await expect(page.getByTestId('csv-import-button')).toBeEnabled({ timeout: 15000 });
  await page.getByTestId('csv-import-button').click();

  // Wait for LLM classify step (can take time)
  await expect(page.getByText(/classifying|processing/i)).toBeVisible({ timeout: 15000 });

  // Wait for review table to appear
  await expect(page.getByTestId('csv-review-table')).toBeVisible({ timeout: 60000 });
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
    const wizard = page.getByTestId('csv-import-wizard');
    await expect(wizard.getByText('Upload')).toBeVisible();
    await expect(wizard.getByText('Classify')).toBeVisible();
    await expect(wizard.getByText('Review')).toBeVisible();
    await expect(wizard.getByText('Done')).toBeVisible();
  });

  test('step 1 shows file input and bank selector', async ({ page }) => {
    // The dropzone area (visible) and bank account selector (visible)
    await expect(page.getByTestId('csv-dropzone')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('csv-bank-account-select')).toBeVisible();
  });

  test('wizard can be dismissed with the × close button', async ({ page }) => {
    const closeButton = page.getByTestId('close-csv-import-wizard');
    await expect(closeButton).toBeVisible({ timeout: 5000 });
    await closeButton.click();

    // Dialog should disappear
    await expect(page.getByTestId('csv-import-wizard')).not.toBeVisible({ timeout: 3000 });
  });

  test('NAB sample CSV fixture is accepted by file input', async ({ page: _page }) => {
    // react-dropzone programmatic file dispatch not reliably supported in Playwright Chromium.
    test.skip(true, 'react-dropzone onDrop not triggerable via Playwright — test manually');
  });
});

// ---------------------------------------------------------------------------
// Functional tests — require LLM API keys + running dev server
// ---------------------------------------------------------------------------

test.describe('harden-import-wizard — Transfer warning flow (requires LLM)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!process.env.OPENAI_API_KEY, 'Requires OPENAI_API_KEY — set to enable LLM tests');
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

    // Click the Confirm button using stable testid
    await expect(page.getByTestId('csv-confirm-import')).toBeVisible({ timeout: 5000 });
    await page.getByTestId('csv-confirm-import').click();

    // Transfer Warning Modal should appear
    await expect(page.getByText(/possible transfers detected/i)).toBeVisible({ timeout: 5000 });
  });

  test('warning modal is informational — "Continue anyway" button is always present', async ({
    page,
  }) => {
    await uploadNabCsvAndClassify(page);
    await page.getByTestId('csv-confirm-import').click();

    // Must have "Continue anyway" — no blocking gate
    await expect(page.getByRole('button', { name: /continue anyway/i })).toBeVisible({ timeout: 5000 });
  });

  test('"Review first" button dismisses modal without blocking', async ({
    page,
  }) => {
    await uploadNabCsvAndClassify(page);
    await page.getByTestId('csv-confirm-import').click();

    const reviewFirstButton = page.getByRole('button', { name: /review first/i });
    await expect(reviewFirstButton).toBeVisible({ timeout: 5000 });
    await reviewFirstButton.click();

    // Modal dismissed — should be back on review step
    await expect(page.getByText(/possible transfers detected/i)).not.toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId('csv-confirm-import')).toBeVisible();
  });

  test('warning modal shows the flagged transaction count', async ({ page }) => {
    await uploadNabCsvAndClassify(page);
    await page.getByTestId('csv-confirm-import').click();

    // Modal text: "N transaction(s) look like inter-account transfers"
    await expect(page.getByText(/transaction.* look like inter-account transfers/i)).toBeVisible({ timeout: 5000 });
  });

  test('warning modal explains user can resolve in Transfers tab later', async ({
    page,
  }) => {
    await uploadNabCsvAndClassify(page);
    await page.getByTestId('csv-confirm-import').click();

    // The modal explains the resolution path — no hard block
    await expect(page.getByText(/resolve any unmatched transfers in the transfers tab/i)).toBeVisible({ timeout: 5000 });
  });
});
