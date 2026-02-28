import { test as setup } from '@playwright/test';

setup('authenticate user', async ({ page }) => {
  // Navigate to login page
  await page.goto('/auth/login');

  // Fill login form with test credentials
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'TestPassword123!');

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for successful redirect to dashboard
  await page.waitForURL('/home');

  // Save authentication state (cookies, localStorage, sessionStorage)
  await page.context().storageState({ path: 'e2e/.auth/user.json' });
});
