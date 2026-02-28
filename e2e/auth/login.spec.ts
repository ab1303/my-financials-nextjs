import { test, expect } from '@playwright/test';

// These tests do NOT use storageState—they test the login flow itself
test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start fresh without any session
    await page.context().clearCookies();
    await page.goto('/auth/login');
  });

  test('valid credentials should redirect to dashboard', async ({ page }) => {
    // Fill and submit login form
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');

    // Verify redirect to home
    await page.waitForURL('/home');
    expect(page.url()).toContain('/home');
  });

  test('invalid email should show error', async ({ page }) => {
    await page.fill('input[name="email"]', 'nonexistent@example.com');
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');

    // Look for error message (adjust selector based on actual UI)
    const errorMsg = page.locator('text=/invalid|incorrect|not found/i');
    await expect(errorMsg).toBeVisible({ timeout: 10000 });
  });

  test('empty email should show validation error', async ({ page }) => {
    // Leave email empty, fill password
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');

    // Check for validation error (adjust selector)
    const emailError = page.locator('input[name="email"]');
    await expect(emailError).toHaveAttribute('aria-invalid', 'true');
  });

  test('empty password should show validation error', async ({ page }) => {
    await page.fill('input[name="email"]', 'test@example.com');
    // Leave password empty
    await page.click('button[type="submit"]');

    const passwordError = page.locator('input[name="password"]');
    await expect(passwordError).toHaveAttribute('aria-invalid', 'true');
  });

  test('unauthenticated user accessing /home should redirect to login', async ({
    page,
  }) => {
    // Start from home, should redirect
    await page.goto('/home');
    await page.waitForURL('/auth/login');
    expect(page.url()).toContain('/auth/login');
  });
});
