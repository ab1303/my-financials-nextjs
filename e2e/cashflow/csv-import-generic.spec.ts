import { expect,test } from '@playwright/test';
async function openImportDialog(page: Parameters<typeof test>[1]) {
  await page.getByTestId('open-csv-import-wizard').click();
  await expect(page.getByTestId('csv-import-wizard')).toBeVisible({ timeout: 8000 });
}

test.describe('Generic CSV Import — Transactions Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cashflow/transactions');
    await page.waitForLoadState('networkidle');
  });

  test('transactions page loads', async ({ page }) => {
    await expect(page).toHaveURL(/transactions/);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('CSV Import button is visible on transactions page', async ({ page }) => {
    const btn = page.getByRole('button', { name: /import|csv/i }).first();
    await expect(btn).toBeVisible();
  });

  test('opening the import dialog shows bank account selector', async ({ page }) => {
    await openImportDialog(page);

    // Stable testid for the bank account select
    const select = page.getByTestId('csv-bank-account-select');
    await expect(select).toBeVisible();
  });

  test('upload zone shows generic copy — not CommBank-specific', async ({ page }) => {
    await openImportDialog(page);

    // New generic copy
    await expect(page.getByText(/export your transaction history/i)).toBeVisible();

    // OLD CommBank-specific copy must NOT appear
    await expect(page.getByText(/Supports CommBank CSV format/i)).not.toBeVisible();
  });

  test('supported banks info box is visible before upload', async ({ page }) => {
    await openImportDialog(page);

    // Should show "Supported banks: CommBank, NAB"
    await expect(page.getByText(/supported banks/i)).toBeVisible();
    await expect(page.getByText(/commbank/i).first()).toBeVisible();
    await expect(page.getByText(/nab/i).first()).toBeVisible();
  });

  test('ANZ and Westpac shown as coming soon', async ({ page }) => {
    await openImportDialog(page);
    await expect(page.getByText(/anz.*coming soon|westpac.*coming soon/i)).toBeVisible();
  });

  test('CommBank CSV upload: shows format-recognised badge and preview', async ({ page: _page }) => {
    // react-dropzone programmatic file dispatch not reliably supported in Playwright Chromium.
    // Covered by manual testing. Use the upload API directly in integration tests instead.
    test.skip(true, 'react-dropzone onDrop not triggerable via Playwright — test manually');
  });

  test('transaction preview shows coloured amounts (DEBIT red, CREDIT green)', async ({ page: _page }) => {
    test.skip(true, 'react-dropzone onDrop not triggerable via Playwright — test manually');
  });
});

