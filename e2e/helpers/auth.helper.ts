import { Page } from '@playwright/test';

export async function ensureAuthenticated(page: Page) {
  // Check if already authenticated by visiting a protected route
  await page.goto('/home');

  // If redirected to login, we need auth (should not happen with storageState)
  if (page.url().includes('auth') || page.url().includes('login')) {
    throw new Error('Not authenticated - storage state may not have loaded');
  }
}

export async function logout(page: Page) {
  // Navigate to account/logout endpoint or click logout button
  const logoutButton = page.locator(
    'button:has-text("Logout"), button:has-text("Sign out")',
  );
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
    // Wait for redirect to login
    await page.waitForURL('**/auth/**');
  }
}
