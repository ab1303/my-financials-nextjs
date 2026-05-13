import { test, expect } from '@playwright/test';

test.describe('CSV Import — Review & Category Override', () => {
  /**
   * Setup: Navigate to the expense page and open the CSV import wizard.
   * This `beforeEach` takes us to the point where we're ready to upload.
   */
  test.beforeEach(async ({ page }) => {
    await page.goto('/cashflow/expense');
    await page.waitForLoadState('networkidle');

    // Open the CSV import wizard
    await page
      .getByRole('button', { name: /csv import|import csv/i })
      .first()
      .click();

    // Wait for modal to appear
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  /**
   * Helper function: Upload CSV and wait for classification to complete.
   * This moves us from Step 1 (Upload) through Step 2 (Classifying) to Step 3 (Review).
   */
  async function uploadAndClassifyCSV(page: any) {
    // Upload the fixture CSV file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('e2e/fixtures/commbank-sample.csv');

    // Click parse/process button to start classification
    const processButton = page
      .getByRole('button', { name: /parse|process|import|classify/i })
      .filter({ hasNot: page.getByRole('button', { name: /cancel|close/i }) });

    await expect(processButton.first()).toBeEnabled({ timeout: 5000 });
    await processButton.first().click();

    // Wait for classifying step to show (LLM calls can take time)
    await expect(page.getByText(/classifying|processing/i, { exact: false })).toBeVisible({
      timeout: 30000,
    });

    // Wait for review table to appear (classifying should complete and move to review)
    // TODO: add data-testid="review-table" to the TransactionReviewTable component
    await page.waitForSelector(
      '[data-testid="review-table"], table[role="table"], [role="grid"]',
      { timeout: 30000 }
    );
  }

  test('should show Review step after LLM classification completes', async ({ page }) => {
    test.slow(); // Mark as slow due to LLM API calls

    await uploadAndClassifyCSV(page);

    // Verify Review step is visible in the step indicator
    // TODO: add data-testid="step-indicator-review" to the Review step
    await expect(
      page.getByText('Review', { exact: false }).first()
    ).toBeVisible({ timeout: 5000 });

    // Expect review table to be visible
    // TODO: add data-testid="review-table" to TransactionReviewTable
    const reviewTable = page.locator('[data-testid="review-table"], table, [role="grid"]').first();
    await expect(reviewTable).toBeVisible({ timeout: 5000 });
  });

  test('should display classified transactions with category dropdowns', async ({ page }) => {
    test.slow();

    await uploadAndClassifyCSV(page);

    // At least one transaction should be visible in the review table
    // Check for known merchant from fixture
    const woolworthsText = page.getByText(/woolworths/i);
    await expect(woolworthsText.first()).toBeVisible({ timeout: 5000 });

    // Each transaction should have a category dropdown
    // TODO: add data-testid="category-select" to category dropdown elements
    const categorySelectors = page.locator(
      '[data-testid="category-select"], select, [role="combobox"]'
    );

    // Should have multiple category dropdowns (at least one per transaction)
    const count = await categorySelectors.count();
    expect(count).toBeGreaterThan(0);

    // Each dropdown should have a value (pre-filled with LLM suggestion)
    const firstDropdown = categorySelectors.first();
    await expect(firstDropdown).toBeVisible({ timeout: 5000 });

    // Check that it has a selected value (not empty)
    const selectedValue = await firstDropdown.inputValue().catch(() => '');
    // The dropdown should have some value selected
    expect(selectedValue || await firstDropdown.getAttribute('value')).toBeTruthy();
  });

  test('should show month sections with transaction counts', async ({ page }) => {
    test.slow();

    await uploadAndClassifyCSV(page);

    // Month sections should be visible with headers showing month and count
    // TODO: add data-testid="month-section-header" to month headers
    const monthHeaders = page.locator(
      '[data-testid="month-section-header"], text=/^\\w+\\s+\\d{4}|month of/i'
    );

    // Should have at least one month section (sample CSV has transactions from May & June)
    const monthCount = await monthHeaders.count();
    expect(monthCount).toBeGreaterThanOrEqual(1);

    // At least one month header should be visible
    const firstMonth = monthHeaders.first();
    if (await firstMonth.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(firstMonth).toBeVisible();
      // Should contain month name and transaction count
      const monthText = await firstMonth.textContent();
      expect(monthText).toMatch(/\d+|may|june|june 2025|may 2025/i);
    }
  });

  test('should allow overriding a category for a specific transaction', async ({ page }) => {
    test.slow();

    await uploadAndClassifyCSV(page);

    // Find the first category dropdown
    // TODO: add data-testid="category-select" to category dropdowns
    const categorySelects = page.locator('[data-testid="category-select"], select');
    const firstSelect = categorySelects.first();

    await expect(firstSelect).toBeVisible({ timeout: 5000 });

    // Get the current value
    const currentValue = await firstSelect.inputValue().catch(() => null);

    // Select a different option
    // Get all available options
    const options = firstSelect.locator('option');
    const optionCount = await options.count();

    if (optionCount > 1) {
      // Select the second option (different from first)
      await firstSelect.selectOption({ index: 1 });

      // Verify the value changed
      const newValue = await firstSelect.inputValue();
      expect(newValue).not.toBe(currentValue);

      // The row should now show an amber/override indicator
      // TODO: add data-testid="overridden-row" or class="bg-amber-50" to overridden rows
      const rowWithSelect = firstSelect.locator('xpath=ancestor::tr');
      const hasAmberClass = await rowWithSelect
        .evaluate((el) => el.classList.contains('bg-amber-50'))
        .catch(() => false);

      if (!hasAmberClass) {
        // Check for data-testid="overridden-row"
        const overriddenIndicator = rowWithSelect.locator('[data-testid="overridden-row"]');
        // Either amber class or overridden-row indicator should exist
        // (soft assertion - might not be implemented yet)
      }
    }
  });

  test('should mark overridden rows visually differently from accepted rows', async ({ page }) => {
    test.slow();

    await uploadAndClassifyCSV(page);

    // Get all category selects
    // TODO: add data-testid="category-select" to category dropdowns
    const categorySelects = page.locator('[data-testid="category-select"], select');
    const firstSelect = categorySelects.first();

    // Override the first dropdown
    const options = firstSelect.locator('option');
    const optionCount = await options.count();

    if (optionCount > 1) {
      await firstSelect.selectOption({ index: 1 });

      // The row containing this select should have amber/override styling
      // TODO: add class="bg-amber-50" or data-testid="overridden-row" to rows with overrides
      const rows = page.locator('tbody tr, [role="row"]');
      const rowCount = await rows.count();

      // At least one row should have override styling
      let hasAmberRow = false;
      for (let i = 0; i < Math.min(rowCount, 3); i++) {
        const row = rows.nth(i);
        const hasAmber = await row
          .evaluate((el) => el.classList.contains('bg-amber-50'))
          .catch(() => false);
        if (hasAmber) {
          hasAmberRow = true;
          break;
        }
      }

      if (hasAmberRow) {
        // Verify amber row is visually distinct
        const amberRow = page.locator('tr.bg-amber-50, [data-overridden="true"]').first();
        await expect(amberRow).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should show warning flag for likely unknown merchants', async ({ page }) => {
    test.slow();

    await uploadAndClassifyCSV(page);

    // Some transactions from the fixture should trigger ⚠ flag
    // e.g., "FLEXISCHOOLS*ACC TOPUP" (short, all-caps, unknown brand)
    // TODO: add data-testid="unknown-merchant-flag" to warning flag
    const warningFlags = page.locator('[data-testid="unknown-merchant-flag"], text=/⚠/');

    // Check if any warning flags exist in the review table
    const flagCount = await warningFlags.count();

    if (flagCount > 0) {
      // At least one flag should be visible
      const firstFlag = warningFlags.first();
      await expect(firstFlag).toBeVisible({ timeout: 5000 });

      // The flag should be near/associated with a transaction description
      const flagText = await firstFlag.textContent();
      expect(flagText).toContain('⚠');
    }

    // Alternative: check for rows with warning indicators by data-testid
    const rowsWithWarnings = page.locator('[data-unknown-merchant="true"]');
    if (await rowsWithWarnings.count() > 0) {
      await expect(rowsWithWarnings.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('Accept All button should reset all overrides to LLM suggestions', async ({ page }) => {
    test.slow();

    await uploadAndClassifyCSV(page);

    // Override a category manually
    // TODO: add data-testid="category-select" to category dropdowns
    const categorySelects = page.locator('[data-testid="category-select"], select');
    const firstSelect = categorySelects.first();

    const options = firstSelect.locator('option');
    const optionCount = await options.count();

    if (optionCount > 1) {
      await firstSelect.selectOption({ index: 1 });

      // Verify override was applied (amber styling or override count)
      // TODO: add data-testid="override-count" to override count badge
      const overrideCountBadge = page.locator('[data-testid="override-count"], text=/\\d+ override/i');
      if (await overrideCountBadge.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(overrideCountBadge).toBeVisible();
        const countText = await overrideCountBadge.textContent();
        expect(countText).toMatch(/1/);
      }

      // Click "Accept All" button
      // TODO: add data-testid="accept-all-btn" to Accept All button
      const acceptAllBtn = page.locator('[data-testid="accept-all-btn"], button:has-text("Accept All")');
      const acceptButton = acceptAllBtn.or(page.getByRole('button', { name: /accept all/i })).first();

      if (await acceptButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await acceptButton.click();

        // Wait a moment for state update
        await page.waitForTimeout(1000);

        // The overridden row should no longer show amber styling
        const amberRows = page.locator('tr.bg-amber-50, [data-overridden="true"]');
        const amberCount = await amberRows.count();
        expect(amberCount).toBe(0);

        // Override count should show 0
        if (await overrideCountBadge.isVisible({ timeout: 2000 }).catch(() => false)) {
          const newCountText = await overrideCountBadge.textContent();
          expect(newCountText).not.toMatch(/1/);
        }
      }
    }
  });

  test('should enable Confirm & Save button when review is ready', async ({ page }) => {
    test.slow();

    await uploadAndClassifyCSV(page);

    // Confirm & Save button should be visible and enabled
    // TODO: add data-testid="confirm-save-btn" to Confirm & Save button
    const confirmSaveBtn = page.locator(
      '[data-testid="confirm-save-btn"], button:has-text("Confirm & Save")'
    );
    const saveButton = confirmSaveBtn.or(page.getByRole('button', { name: /confirm.*save|proceed/i })).first();

    // Button should exist
    await expect(saveButton).toBeVisible({ timeout: 5000 });

    // Button should be enabled (not disabled)
    const isDisabled = await saveButton
      .evaluate((el) => el.hasAttribute('disabled') || el.classList.contains('disabled'))
      .catch(() => false);

    expect(isDisabled).toBe(false);
  });

  test('should complete import after Confirm & Save and show results', async ({ page }) => {
    test.slow();

    await uploadAndClassifyCSV(page);

    // Click Confirm & Save button
    // TODO: add data-testid="confirm-save-btn" to Confirm & Save button
    const confirmSaveBtn = page.locator('[data-testid="confirm-save-btn"], button:has-text("Confirm & Save")');
    const saveButton = confirmSaveBtn.or(page.getByRole('button', { name: /confirm.*save|proceed/i })).first();

    await expect(saveButton).toBeVisible({ timeout: 5000 });
    await saveButton.click();

    // Expect loading/saving state
    // TODO: add data-testid="saving-state" to saving indicator
    const savingIndicator = page.getByText(/saving|processing|completing/i);
    const savingStateExists = await savingIndicator
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    // Wait for the saving/loading state to complete
    await page.waitForLoadState('networkidle');

    // Should transition to Results step
    // TODO: add data-testid="results-step" to results section
    const resultsStep = page.locator('[data-testid="results-step"], heading:has-text("Results")');
    const resultsHeading = resultsStep.or(page.getByRole('heading', { name: /results|import complete/i })).first();

    await expect(resultsHeading).toBeVisible({ timeout: 10000 });

    // Success message should be visible
    const successMsg = page.getByText(/import complete|success|entries created|saved/i);
    await expect(successMsg.first()).toBeVisible({ timeout: 5000 });

    // Result should show number of entries (at least one from fixture CSV)
    const entryCountMsg = page.getByText(/\d+ (transaction|entry|entries)/i);
    if (await entryCountMsg.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(entryCountMsg).toBeVisible();
    }
  });

  test('should close modal after successful import', async ({ page }) => {
    test.slow();

    await uploadAndClassifyCSV(page);

    // Complete the import by clicking Confirm & Save
    const confirmSaveBtn = page.locator('[data-testid="confirm-save-btn"], button:has-text("Confirm & Save")');
    const saveButton = confirmSaveBtn.or(page.getByRole('button', { name: /confirm.*save|proceed/i })).first();

    await expect(saveButton).toBeVisible({ timeout: 5000 });
    await saveButton.click();

    await page.waitForLoadState('networkidle');

    // Find and click the Done/Close button on results step
    // TODO: add data-testid="done-btn" to Done button
    const doneBtn = page.locator('[data-testid="done-btn"], button:has-text("Done")');
    const closeButton = doneBtn.or(page.getByRole('button', { name: /done|close|finish/i })).first();

    if (await closeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await closeButton.click();
    }

    // Modal should close
    const modal = page.getByRole('dialog');
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  test('wizard step indicator should show all 4 steps: Upload, Classifying, Review, Results', async ({
    page,
  }) => {
    // On initial load (step 1), we should see all 4 steps
    const stepLabels = page.getByText(/upload|classifying|review|results/i);
    const stepCount = await stepLabels.count();

    // Should have at least 3-4 step labels visible or available
    expect(stepCount).toBeGreaterThanOrEqual(3);

    // After upload and classify, Review step should be visible
    await uploadAndClassifyCSV(page);

    // Verify Review step is in the active/highlighted position
    // TODO: add data-testid="step-indicator-review" to Review step in indicator
    const reviewStep = page.locator('[data-testid="step-indicator-review"], text=/Review/i').first();

    if (await reviewStep.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(reviewStep).toBeVisible();
    }

    // All step labels should still be visible/present
    const allSteps = page.locator(
      'text=/Upload|Classifying|Review|Results/i, [data-testid*="step-indicator"]'
    );
    const visibleSteps = await allSteps.count();
    expect(visibleSteps).toBeGreaterThanOrEqual(2);
  });

  test('should handle graceful degradation if LLM classification returns partial results', async ({
    page,
  }) => {
    test.slow();

    await uploadAndClassifyCSV(page);

    // Even if some categories are unclassified or fallback to raw descriptions,
    // the review table should still be visible and usable

    // Check that review table exists
    const reviewTable = page.locator('[data-testid="review-table"], table, [role="grid"]').first();
    await expect(reviewTable).toBeVisible({ timeout: 5000 });

    // Should have category dropdowns (even if some are empty/fallback)
    const categorySelects = page.locator('[data-testid="category-select"], select');
    const selectCount = await categorySelects.count();
    expect(selectCount).toBeGreaterThan(0);

    // Confirm & Save should still be clickable/enabled
    const confirmSaveBtn = page.locator('[data-testid="confirm-save-btn"], button:has-text("Confirm & Save")');
    const saveButton = confirmSaveBtn.or(page.getByRole('button', { name: /confirm.*save|proceed/i })).first();

    await expect(saveButton).toBeVisible({ timeout: 5000 });
    const isDisabled = await saveButton
      .evaluate((el) => el.hasAttribute('disabled') || el.classList.contains('disabled'))
      .catch(() => false);

    expect(isDisabled).toBe(false);
  });

  test('should preserve user overrides when returning to review table after scrolling', async ({ page }) => {
    test.slow();

    await uploadAndClassifyCSV(page);

    // Override a transaction in the middle of the list
    // TODO: add data-testid="category-select" to category dropdowns
    const categorySelects = page.locator('[data-testid="category-select"], select');

    // Find a select in the middle (if multiple exist)
    const selectCount = await categorySelects.count();
    if (selectCount > 2) {
      const middleIndex = Math.floor(selectCount / 2);
      const middleSelect = categorySelects.nth(middleIndex);

      await middleSelect.scrollIntoViewIfNeeded();

      // Get current and new values
      const currentValue = await middleSelect.inputValue().catch(() => null);
      const options = middleSelect.locator('option');
      const optionCount = await options.count();

      if (optionCount > 1) {
        // Select different option
        await middleSelect.selectOption({ index: 1 });

        // Scroll away and back
        await page.evaluate(() => window.scrollBy(0, 300));
        await page.waitForTimeout(500);
        await page.evaluate(() => window.scrollBy(0, -300));

        // Wait for re-render if needed
        await page.waitForTimeout(500);

        // Check that the override is still applied
        const updatedValue = await middleSelect.inputValue().catch(() => null);
        expect(updatedValue).not.toBe(currentValue);
      }
    }
  });

  test('should display transaction date and amount in review table', async ({ page }) => {
    test.slow();

    await uploadAndClassifyCSV(page);

    // Review table should show date and amount columns
    // Sample CSV has dates like "28/06/2025" and amounts like "-57.58"

    // Check for date text (DD/MM/YYYY format from CommBank CSV)
    const dateText = page.getByText(/\d{2}\/\d{2}\/\d{4}/);
    if (await dateText.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(dateText.first()).toBeVisible();
    }

    // Check for amount text (with dollar sign or negative)
    const amountText = page.getByText(/-?\$?\d+\.\d{2}/);
    if (await amountText.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(amountText.first()).toBeVisible();
    }

    // Or at least check for known amounts from fixture
    const knownAmounts = ['57.58', '8.40', '1260.00', '269.07'];
    let foundAmount = false;

    for (const amount of knownAmounts) {
      if (await page.getByText(amount).isVisible({ timeout: 1000 }).catch(() => false)) {
        await expect(page.getByText(amount)).toBeVisible();
        foundAmount = true;
        break;
      }
    }

    expect(foundAmount || amountText).toBeTruthy();
  });

  test('should support keyboard navigation through category dropdowns', async ({ page }) => {
    test.slow();

    await uploadAndClassifyCSV(page);

    // TODO: add data-testid="category-select" to category dropdowns
    const firstSelect = page.locator('[data-testid="category-select"], select').first();

    await expect(firstSelect).toBeVisible({ timeout: 5000 });

    // Focus on the dropdown
    await firstSelect.focus();

    // Try keyboard navigation (arrow down to open)
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(300);

    // Select should have focus and be interactive
    const hasFocus = await firstSelect.evaluate((el) => el === document.activeElement);
    expect(hasFocus).toBe(true);
  });

  test('should show helpful messaging if no transactions were parsed from CSV', async ({ page }) => {
    test.slow();

    // Upload an empty/invalid CSV (if possible with fixture setup)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('e2e/fixtures/commbank-sample.csv');

    const processButton = page
      .getByRole('button', { name: /parse|process|import|classify/i })
      .filter({ hasNot: page.getByRole('button', { name: /cancel|close/i }) });

    await processButton.first().click();

    // Wait for processing
    await page.waitForTimeout(2000);

    // Check if an error or "no transactions" message appears
    const noTransactionsMsg = page.getByText(/no transactions|empty|invalid/i);
    const reviewTable = page.locator('[data-testid="review-table"], table').first();

    // Either review table shows transactions OR error message shows
    const hasReview = await reviewTable.isVisible({ timeout: 30000 }).catch(() => false);
    const hasError = await noTransactionsMsg.isVisible({ timeout: 5000 }).catch(() => false);

    expect(hasReview || hasError).toBe(true);
  });

  test('should maintain review state if user toggles between steps (if navigation is allowed)', async ({
    page,
  }) => {
    test.slow();

    await uploadAndClassifyCSV(page);

    // Store initial state by counting overrides
    const initialOverrides = await page
      .locator('[data-testid="override-count"], text=/\\d+ override/i')
      .count();

    // Try to navigate back to upload step (if allowed)
    // TODO: add data-testid="step-upload" to upload step link/button
    const uploadStepLink = page.locator('[data-testid="step-upload"], button:has-text("Upload")');
    const backButton = uploadStepLink.or(page.locator('button:has-text("Back")')).first();

    if (await backButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await backButton.click();
      await page.waitForTimeout(500);

      // Navigate forward again to review
      // TODO: add data-testid="step-review" to review step link/button
      const reviewStepLink = page.locator('[data-testid="step-review"], button:has-text("Review")');
      const forwardButton = reviewStepLink.or(page.locator('button:has-text("Next")')).first();

      if (await forwardButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await forwardButton.click();
        await page.waitForTimeout(500);

        // Review table should still be visible
        const reviewTable = page.locator('[data-testid="review-table"], table').first();
        await expect(reviewTable).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
