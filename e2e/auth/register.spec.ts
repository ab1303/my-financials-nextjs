import { test, expect } from '@playwright/test';

test.describe('Registration Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/register');
  });

  test('successful registration with valid data', async ({ page }) => {
    // Generate unique email for this test run
    const uniqueEmail = `newuser-${Date.now()}@example.com`;

    await page.fill('input[name="email"]', uniqueEmail);
    await page.fill('input[name="name"]', 'New Test User');
    await page.fill('input[name="password"]', 'ValidPassword123!');
    await page.fill('input[name="confirmPassword"]', 'ValidPassword123!');

    await page.click('button[type="submit"]');

    // Should either redirect to login or show success message
    await page.waitForURL('/auth/login', { timeout: 5000 }).catch(async () => {
      // Or check for success toast
      const successMsg = page.locator('text=/success|registered|created/i');
      await expect(successMsg).toBeVisible({ timeout: 5000 });
    });
  });

  test('duplicate email should show error', async ({ page }) => {
    // Use the seed user email
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="name"]', 'Another User');
    await page.fill('input[name="password"]', 'ValidPassword123!');
    await page.fill('input[name="confirmPassword"]', 'ValidPassword123!');

    await page.click('button[type="submit"]');

    // Check for duplicate error
    const error = page.locator(
      'text=/already exists|duplicate|already registered/i',
    );
    await expect(error).toBeVisible({ timeout: 10000 });
  });

  test('password mismatch should show error', async ({ page }) => {
    await page.fill('input[name="email"]', `newuser-${Date.now()}@example.com`);
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="password"]', 'Password123!');
    await page.fill('input[name="confirmPassword"]', 'DifferentPassword123!');

    await page.click('button[type="submit"]');

    const error = page.locator('text=/password|match|confirm/i');
    await expect(error).toBeVisible({ timeout: 10000 });
  });
});
