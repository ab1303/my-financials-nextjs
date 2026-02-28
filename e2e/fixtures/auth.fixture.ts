import { test as base, expect } from '@playwright/test';

type AuthFixtures = {
  authenticatedPage: typeof expect;
};

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Use the storageState that was set up by auth.setup.ts
    // The page already has the authenticated session loaded
    // Just verify we're authenticated
    await page.goto('/home');

    // If we get redirected to login, something went wrong with auth setup
    if (page.url().includes('auth') || page.url().includes('login')) {
      throw new Error('Authentication setup failed - user not logged in');
    }

    await use(expect);
  },
});

export { expect };
