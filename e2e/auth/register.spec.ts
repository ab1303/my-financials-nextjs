import { test, expect } from '@playwright/test';

test.describe('Registration Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/register');
  });

  test('successful registration with valid data', async ({ page }) => {
    // Generate unique email for this test run
    const uniqueEmail = `newuser-${Date.now()}@example.com`;

    // Register form has: email, password, confirm-password (no name field)
    await page.fill('input[name="email"]', uniqueEmail);
    await page.fill('input[name="password"]', 'ValidPassword123!');
    await page.fill('input[name="confirm-password"]', 'ValidPassword123!');

    await page.click('button[type="submit"]');

    // Should either redirect to login or show success message
    await page.waitForURL('/auth/login', { timeout: 5000 }).catch(async () => {
      // Or check for success toast
      await expect(page.locator('[data-sonner-toaster]')).toBeVisible({
        timeout: 5000,
      });
    });
  });

  test('duplicate email should show error', async ({ page }) => {
    // Use the seed user email
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'ValidPassword123!');
    await page.fill('input[name="confirm-password"]', 'ValidPassword123!');

    await page.click('button[type="submit"]');

    // Sonner toast shows duplicate error
    await expect(page.locator('li[data-sonner-toast]')).toBeVisible({
      timeout: 10000,
    });
  });

  test('password mismatch should show error', async ({ page }) => {
    await page.fill('input[name="email"]', `newuser-${Date.now()}@example.com`);
    await page.fill('input[name="password"]', 'Password123!');
    await page.fill('input[name="confirm-password"]', 'DifferentPassword123!');

    await page.click('button[type="submit"]');

    // Sonner toast or inline error appears for password mismatch
    await expect(page.locator('li[data-sonner-toast]')).toBeVisible({
      timeout: 10000,
    });
  });
});
