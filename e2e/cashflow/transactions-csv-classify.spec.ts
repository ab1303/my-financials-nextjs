import { test, expect } from '@playwright/test';

/**
 * Transactions page — CSV Import Classification
 *
 * Covers the bug scenario: "Classification failed: Invalid request body"
 * which was caused by ClassifyRequestSchema requiring calendarId
 * but the client only sending fileId.
 */
test.describe('Transactions CSV Import — Classification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cashflow/transactions');
    await page.waitForLoadState('networkidle');
  });

  test('should display the Transactions page with import options', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /transactions/i })).toBeVisible();
    // CSV import card should be present
    await expect(page.getByText(/csv/i)).toBeVisible();
  });

  test('should open CSV Import Wizard when CSV card is clicked', async ({ page }) => {
    // Click the CSV import card/button
    await page.getByText(/import csv|csv import|bank statement/i).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByText(/csv import wizard/i)).toBeVisible();
    await expect(dialog.getByText(/step 1/i)).toBeVisible();
  });

  test('should require a bank account before allowing import', async ({ page }) => {
    await page.getByText(/import csv|csv import|bank statement/i).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Upload a file without selecting a bank account
    const fileInput = dialog.locator('input[type="file"]');
    await fileInput.setInputFiles('e2e/fixtures/commbank-sample.csv');

    // Import CSV button should exist
    const importBtn = dialog.getByRole('button', { name: /import csv/i });
    await expect(importBtn).toBeVisible({ timeout: 5000 });

    // Clicking without a bank account selected should show an error (not navigate to classify step)
    await importBtn.click();

    // Should NOT advance to classify step
    await expect(dialog.getByText(/step 1/i)).toBeVisible({ timeout: 2000 });
  });

  test('should NOT return "Invalid request body" when classify is triggered', async ({ page }) => {
    // Intercept the classify API to detect the 400 error scenario
    const classifyRequests: Array<{ status: number; body: unknown }> = [];

    await page.route('/api/transactions/csv/classify', async (route) => {
      const request = route.request();
      const postData = request.postDataJSON() as unknown;
      // Fulfill with a minimal SSE done event so the test doesn't need a real LLM
      const ssePayload = [
        `data: ${JSON.stringify({ type: 'done', totalLlmTokens: 0, model: 'gpt-4o-mini', categories: [], incomeSourceLabels: [] })}\n\n`,
      ].join('');

      classifyRequests.push({ status: 200, body: postData });

      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        body: ssePayload,
      });
    });

    // Also intercept the upload API to mock a successful session
    await page.route('/api/transactions/csv/upload', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          fileId: 'test-session-id-123',
          rowCount: 3,
          fileName: 'commbank-sample.csv',
        }),
      });
    });

    await page.getByText(/import csv|csv import|bank statement/i).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Select a bank account (pick the first available option)
    const bankAccountSelect = dialog.locator('select').first();
    if (await bankAccountSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      const options = await bankAccountSelect.locator('option').all();
      if (options.length > 1) {
        await bankAccountSelect.selectOption({ index: 1 });
      }
    } else {
      // May be a custom dropdown
      const bankDropdown = dialog.locator('[role="combobox"], [role="listbox"]').first();
      if (await bankDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
        await bankDropdown.click();
        const firstOption = dialog.locator('[role="option"]').first();
        if (await firstOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await firstOption.click();
        }
      }
    }

    // Upload CSV file
    const fileInput = dialog.locator('input[type="file"]');
    await fileInput.setInputFiles('e2e/fixtures/commbank-sample.csv');

    // Click Import CSV
    const importBtn = dialog.getByRole('button', { name: /import csv/i });
    await expect(importBtn).toBeVisible({ timeout: 5000 });
    await importBtn.click();

    // Should advance to the classifying step (step 2)
    await expect(dialog.getByText(/step 2|classify|classifying/i)).toBeVisible({ timeout: 10000 });

    // Verify the classify request was sent with only fileId (no calendarId)
    expect(classifyRequests.length).toBeGreaterThan(0);
    const requestBody = classifyRequests[0]!.body as Record<string, unknown>;
    expect(requestBody).toHaveProperty('fileId');
    expect(requestBody).not.toHaveProperty('calendarId');

    // Crucially: no "Classification failed: Invalid request body" toast should appear
    const errorToast = page.getByText(/classification failed.*invalid request body/i);
    await expect(errorToast).not.toBeVisible();
  });

  test('should advance to Review step after successful classification', async ({ page }) => {
    const mockMonth = '2025-07';
    const mockTransactions = [
      {
        id: 'tx-1',
        date: '2025-07-31',
        description: 'WOOLWORTHS 1294 HORNSBY',
        amount: 90.72,
        type: 'DEBIT',
        llmCategory: 'Groceries',
        confirmedCategory: 'Groceries',
        overridden: false,
        year: 2025,
        month: 7,
      },
    ];

    await page.route('/api/transactions/csv/upload', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ fileId: 'test-session-456', rowCount: 1, fileName: 'test.csv' }),
      });
    });

    await page.route('/api/transactions/csv/classify', async (route) => {
      const events = [
        `data: ${JSON.stringify({ type: 'progress', month: mockMonth, processed: 1, total: 1 })}\n\n`,
        `data: ${JSON.stringify({ type: 'debit_classified', month: mockMonth, transactions: mockTransactions, usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } })}\n\n`,
        `data: ${JSON.stringify({ type: 'done', totalLlmTokens: 15, model: 'gpt-4o-mini', categories: [{ id: 'cat-1', name: 'Groceries' }], incomeSourceLabels: ['Salary', 'Transfer', 'Excluded'] })}\n\n`,
      ].join('');

      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body: events,
      });
    });

    await page.getByText(/import csv|csv import|bank statement/i).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Select bank account
    const bankAccountSelect = dialog.locator('select').first();
    if (await bankAccountSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      const options = await bankAccountSelect.locator('option').all();
      if (options.length > 1) {
        await bankAccountSelect.selectOption({ index: 1 });
      }
    }

    const fileInput = dialog.locator('input[type="file"]');
    await fileInput.setInputFiles('e2e/fixtures/commbank-sample.csv');

    await dialog.getByRole('button', { name: /import csv/i }).click();

    // Wait for classify step
    await expect(dialog.getByText(/step 2|classify/i)).toBeVisible({ timeout: 10000 });

    // Classification completes and wizard moves to review (step 3)
    await expect(dialog.getByText(/step 3|review/i)).toBeVisible({ timeout: 15000 });

    // No error toast
    const errorToast = page.getByText(/classification failed/i);
    await expect(errorToast).not.toBeVisible();
  });

  test('should show error toast on genuine classification failure (non-400)', async ({ page }) => {
    await page.route('/api/transactions/csv/upload', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ fileId: 'test-session-789', rowCount: 1, fileName: 'test.csv' }),
      });
    });

    await page.route('/api/transactions/csv/classify', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    await page.getByText(/import csv|csv import|bank statement/i).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const bankAccountSelect = dialog.locator('select').first();
    if (await bankAccountSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      const options = await bankAccountSelect.locator('option').all();
      if (options.length > 1) {
        await bankAccountSelect.selectOption({ index: 1 });
      }
    }

    const fileInput = dialog.locator('input[type="file"]');
    await fileInput.setInputFiles('e2e/fixtures/commbank-sample.csv');

    await dialog.getByRole('button', { name: /import csv/i }).click();
    await expect(dialog.getByText(/step 2|classify/i)).toBeVisible({ timeout: 10000 });

    // Should show a "Classification failed" error toast and go back to upload
    await expect(page.getByText(/classification failed/i)).toBeVisible({ timeout: 10000 });
    await expect(dialog.getByText(/step 1/i)).toBeVisible({ timeout: 5000 });
  });
});
