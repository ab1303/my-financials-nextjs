import { test, expect } from '@playwright/test';
import path from 'path';

const COMMBANK_FIXTURE = path.resolve('e2e/fixtures/commbank-sample.csv');

// The dialog panel is the visible element; the outer `role="dialog"` wrapper
// from Headless UI is `position: relative` (not itself visible). We target
// content inside the panel directly.
const DIALOG_TITLE_TEXT = /csv import wizard/i;

async function openImportDialog(page: Parameters<typeof test>[1]) {
  await page.getByRole('button', { name: /import|csv/i }).first().click();
  // Wait for the visible dialog content (title), not the outer role="dialog" wrapper
  await expect(page.getByText(DIALOG_TITLE_TEXT)).toBeVisible({ timeout: 8000 });
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

    // Bank account selector must be present inside the dialog panel
    const select = page.locator('Dialog.Panel select, [class*="Dialog"] select, select').first();
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

  test('CommBank CSV upload: shows format-recognised badge and preview', async ({ page }) => {
    await openImportDialog(page);

    // Select first available bank account
    const select = page.locator('select').first();
    const options = await select.locator('option').all();
    let accountId = '';
    for (const opt of options) {
      const val = await opt.getAttribute('value');
      if (val && val.length > 0) { accountId = val; break; }
    }
    if (!accountId) { test.skip(); return; }
    await select.selectOption(accountId);

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(COMMBANK_FIXTURE);

    // Should show format badge (CheckCircle + "bank format recognised" or "format auto-detected")
    await expect(
      page.getByText(/bank format recognised|format auto-detected/i)
    ).toBeVisible({ timeout: 10000 });

    // Should show transaction preview
    await expect(page.getByText(/preview/i)).toBeVisible();
  });

  test('transaction preview shows coloured amounts (DEBIT red, CREDIT green)', async ({ page }) => {
    await openImportDialog(page);

    const select = page.locator('select').first();
    const options = await select.locator('option').all();
    let accountId = '';
    for (const opt of options) {
      const val = await opt.getAttribute('value');
      if (val && val.length > 0) { accountId = val; break; }
    }
    if (!accountId) { test.skip(); return; }
    await select.selectOption(accountId);

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(COMMBANK_FIXTURE);

    await page.waitForTimeout(3000);

    const debitAmounts = page.locator('.text-red-600');
    const creditAmounts = page.locator('.text-green-600');
    const totalColoured = (await debitAmounts.count()) + (await creditAmounts.count());

    // CommBank fixture has 10 rows — expect at least 1 coloured amount visible
    expect(totalColoured).toBeGreaterThan(0);
  });
});



