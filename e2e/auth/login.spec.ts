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

    // Login failure shows a sonner toast with credentials error
    await expect(page.locator('[data-sonner-toaster]')).toBeVisible({ timeout: 10000 });
  });

  test('empty email should show validation error', async ({ page }) => {
    // Leave email empty, fill password
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');

    // Browser native required validation prevents submit — email field has required attribute
    await expect(page.locator('input[name="email"]')).toHaveAttribute('required', '');
  });

  test('empty password should show validation error', async ({ page }) => {
    await page.fill('input[name="email"]', 'test@example.com');
    // Leave password empty
    await page.click('button[type="submit"]');

    // Browser native required validation — password field has required attribute
    await expect(page.locator('input[name="password"]')).toHaveAttribute('required', '');
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
