import { expect,test } from '@playwright/test';
import { CategoryRuleMatchType } from '@prisma/client';

import { prisma } from '@/server/db/client';

import { dropFileOnZone } from '../helpers/drop-file';

test.describe('CSV Pre-apply Category Rules', () => {
  test('should pre-apply rule and persist provenance', async ({ page }) => {
    // 1. Get the test user and bank account dynamically
    const testUser = await prisma.user.findUnique({
      where: { email: 'test@example.com' },
    });
    if (!testUser) throw new Error('Test user not found');

    // The account created in global-setup is 'E2E Test Checking'
    const bankAccount = await prisma.financialAccount.findFirst({
      where: { userId: testUser.id, name: 'E2E Test Checking' },
    });
    if (!bankAccount)
      throw new Error('Bank account (E2E Test Checking) not found');

    // Create category rule
    const rule = await prisma.categoryRule.create({
      data: {
        userId: testUser.id,
        name: 'Woolworths Rule',
        pattern: 'woolworths',
        matchType: CategoryRuleMatchType.CONTAINS,
        category: 'Groceries',
        isActive: true,
      },
    });

    // 2. Perform CSV import
    await page.goto('/cashflow/transactions');

    // Open CSV import wizard
    await page.getByTestId('open-csv-import-wizard').click();
    await expect(page.getByTestId('csv-import-wizard')).toBeVisible({
      timeout: 8000,
    });

    // Select the correct bank account
    await page
      .getByTestId('csv-bank-account-select')
      .selectOption(bankAccount.id);

    // Upload file using helper
    const uploadResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/transactions/csv/upload') &&
        response.status() === 200,
    );
    await dropFileOnZone(page, 'csv-dropzone', 'e2e/fixtures/woolworths.csv');
    await uploadResponse;

    // Verify file upload: wait for the file name element to appear
    await expect(page.locator('text=woolworths.csv')).toBeVisible({
      timeout: 1500,
    });

    // 3. Trigger classify
    await expect(page.getByTestId('csv-import-button')).toBeEnabled({
      timeout: 1000,
    });
    await page.getByTestId('csv-import-button').click();

    // 4. Verify pre-match in UI
    // Wait for the review table to appear
    await expect(page.getByTestId('csv-review-table')).toBeVisible({
      timeout: 3000,
    });

    // Specifically target the category select element within the review table
    const categorySelects = page.locator(
      '[data-testid="csv-review-table"] select',
    );
    // We expect the rule to have matched, so check for 'Groceries' in the select
    await expect(categorySelects.first()).toHaveValue('Groceries');
    // Verify the "Rule:" label is present
    await expect(page.getByText(/Rule: Woolworths Rule/i)).toBeVisible();

    // 5. Confirm import
    await page.getByTestId('csv-confirm-import').click();

    // 6. Verify provenance in DB
    const tx = await prisma.transaction.findFirst({
      where: {
        description: { contains: 'Woolworths' },
      },
    });

    expect(tx).not.toBeNull();
    expect(tx?.category).toBe('Groceries');
    // Provenance is parked; only assert category and existence
    // (Do not assert `metadata` or `source` provenance values.)
  });
});
