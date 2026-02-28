import { Page } from '@playwright/test';

export async function fillFormField(page: Page, label: string, value: string) {
  // Try to find by label
  const labelElement = page.locator(`label:has-text("${label}")`);
  if (await labelElement.isVisible()) {
    const input = labelElement.locator('+ input, ~ input').first();
    if (await input.isVisible()) {
      await input.fill(value);
      return;
    }
  }

  // Try to find by placeholder
  const inputByPlaceholder = page
    .locator(`input[placeholder*="${label}"]`)
    .first();
  if (await inputByPlaceholder.isVisible()) {
    await inputByPlaceholder.fill(value);
    return;
  }

  throw new Error(`Could not find form field for label: ${label}`);
}

export async function selectDropdownOption(page: Page, optionText: string) {
  const combobox = page.locator('[role="combobox"]').first();
  if (await combobox.isVisible()) {
    await combobox.click();
    const option = page.locator(`text=/^${optionText}$/`);
    if (await option.isVisible()) {
      await option.click();
    } else {
      const partialOption = page.locator(`text=${optionText}`);
      if (await partialOption.isVisible()) {
        await partialOption.first().click();
      }
    }
  }
}

export async function submitForm(page: Page) {
  const submitButton = page
    .locator(
      'button[type="submit"], button:has-text("Save"), button:has-text("Create")',
    )
    .first();
  if (await submitButton.isVisible()) {
    await submitButton.click();
  }
}

export async function waitForSuccessMessage(page: Page, timeout = 5000) {
  try {
    await page.waitForSelector(
      'text=/success|added|created|updated|deleted|saved/',
      { timeout },
    );
  } catch (e) {
    // May not have success message, just wait for network idle
    await page.waitForLoadState('networkidle');
  }
}
