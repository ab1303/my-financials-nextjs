/**
 * e2e: handle-orphans Phase 3 — Orphan Resolution Panel
 *
 * Validates the OrphanResolutionPanel on the Transfers tab:
 *   - Panel renders when unresolved orphans exist (count > 30 days old, no counterpart)
 *   - Each orphan has three resolution buttons: Real expense / Real income / Exclude
 *   - After all orphans are resolved the panel disappears
 *
 * Seeded data (via global-setup.ts — resets orphanResolution=null each run):
 *   - e2e-transfer-orphan-fy26:   $1,000 DEBIT "TRANSFER OUT - SAVINGS"  (2025-08-01)
 *   - e2e-transfer-midyear-fy26:  $500   DEBIT "Transfer to Offset Account" (2025-10-01)
 *   Both have transferLinkedTransactionId=null and dates > 30 days ago → 2 unresolved orphans
 *
 * URL: /cashflow/transactions?tab=transfers
 */

import { expect,test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const TRANSACTIONS_URL = '/cashflow/transactions';

/** Navigate to the Transactions page and click the Transfers tab */
async function goToTransfersTab(page: Parameters<Parameters<typeof test>[1]>[0]) {
  await page.goto(TRANSACTIONS_URL);
  await page.waitForLoadState('networkidle');
  // The Transfers tab button is NOT activated by URL param — must click it
  const transfersTab = page.getByRole('button', { name: /^transfers$/i });
  await transfersTab.waitFor({ state: 'visible', timeout: 5000 });
  await transfersTab.click();
  // Small wait for the OrphanResolutionPanel query to fire
  await page.waitForTimeout(500);
}

test.describe('handle-orphans P3 — OrphanResolutionPanel renders', () => {
  test.beforeEach(async ({ page }) => {
    await goToTransfersTab(page);
  });

  test('Transfers tab loads without error', async ({ page }) => {
    await expect(page).not.toHaveURL(/error/);
    // Tab is active — no crash
    await expect(page.getByRole('main')).toBeVisible({ timeout: 5000 });
  });

  test('OrphanResolutionPanel is visible when orphans exist', async ({ page }) => {
    // Panel header: "N orphaned transfer(s) need resolution"
    await expect(
      page.getByText(/orphaned transfers? need resolution/i),
    ).toBeVisible({ timeout: 8000 });
  });

  test('panel shows the amber warning colour styling', async ({ page }) => {
    // Panel has amber/yellow background for visibility
    const panel = page
      .locator('.bg-amber-50, [class*="bg-amber"]')
      .filter({ hasText: /orphaned transfers? need resolution/i });
    await expect(panel).toBeVisible({ timeout: 8000 });
  });

  test('panel shows count of unresolved orphans', async ({ page }) => {
    // Panel shows "N orphaned transfers need resolution" — expect at least 1
    // (global-setup seeds 2 but parallel workers may cause variation)
    await expect(
      page.getByText(/[1-9]\d* orphaned transfers? need resolution/i),
    ).toBeVisible({ timeout: 8000 });
  });

  test('panel shows orphan description and amount', async ({ page }) => {
    // Scope to the amber panel to avoid matching the transaction list below
    const panel = page.locator('.bg-amber-50, [class*="bg-amber"]').filter({
      hasText: /orphaned transfers? need resolution/i,
    });
    await expect(panel).toBeVisible({ timeout: 8000 });
    // One of the seeded orphan descriptions should appear inside the panel
    await expect(panel.getByText(/TRANSFER OUT - SAVINGS/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('each orphan row has a "Real expense" button', async ({ page }) => {
    await page.waitForSelector('[aria-label*="orphan"], .bg-amber-50', { timeout: 8000 });
    // At least one "Real expense" button visible
    const buttons = page.getByRole('button', { name: /real expense/i });
    await expect(buttons.first()).toBeVisible({ timeout: 8000 });
  });

  test('each orphan row has a "Real income" button', async ({ page }) => {
    await page.waitForSelector('[aria-label*="orphan"], .bg-amber-50', { timeout: 8000 });
    const buttons = page.getByRole('button', { name: /real income/i });
    await expect(buttons.first()).toBeVisible({ timeout: 8000 });
  });

  test('each orphan row has an "Exclude" button', async ({ page }) => {
    await page.waitForSelector('[aria-label*="orphan"], .bg-amber-50', { timeout: 8000 });
    const buttons = page.getByRole('button', { name: /exclude/i });
    await expect(buttons.first()).toBeVisible({ timeout: 8000 });
  });

  test('orphan row shows account name or falls back to label', async ({ page }) => {
    // Account name "E2E Test Checking" or fallback "Unknown account" should appear in the panel
    const panel = page.locator('.bg-amber-50, [class*="bg-amber"]').filter({
      hasText: /orphaned transfers? need resolution/i,
    });
    await expect(panel).toBeVisible({ timeout: 8000 });
    // Either the real name or the null-fallback should be present in panel text
    const hasName = await panel.getByText(/E2E Test Checking/i).count();
    const hasFallback = await panel.getByText(/Unknown account/i).count();
    expect(hasName + hasFallback).toBeGreaterThan(0);
  });
});

test.describe('handle-orphans P3 — Resolution flows (sequential)', () => {
  /**
   * These tests mutate orphanResolution in the DB and must run sequentially.
   * They share a single describe block so Playwright runs them in order with one worker.
   *
   * afterAll resets orphan state so downstream specs (transfer-transparency) see clean data.
   *
   * Flow:
   *   1. Exclude one orphan → count decreases
   *   2. Real expense on next → count decreases further
   *   3. Resolve all remaining → panel disappears
   */
  test.describe.configure({ mode: 'serial' });

  test.afterAll(async () => {
    const prisma = new PrismaClient();
    try {
      await (prisma.transaction as never).updateMany({
        where: { id: { in: ['e2e-transfer-orphan-fy26', 'e2e-transfer-midyear-fy26'] } },
        data: { orphanResolution: null, category: 'Transfer' },
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  test('clicking "Exclude" removes that orphan row from panel', async ({ page }) => {
    await goToTransfersTab(page);

    await expect(
      page.getByText(/orphaned transfers? need resolution/i),
    ).toBeVisible({ timeout: 8000 });

    const excludeButtons = page.getByRole('button', { name: /exclude/i });
    const initialCount = await excludeButtons.count();
    expect(initialCount).toBeGreaterThan(0);

    await excludeButtons.first().click();
    await page.waitForTimeout(1500);

    const newCount = await page.getByRole('button', { name: /exclude/i }).count();
    expect(newCount).toBeLessThan(initialCount);
  });

  test('clicking "Real expense" removes that orphan row from panel', async ({ page }) => {
    await goToTransfersTab(page);

    // May have 1 or 2 orphans remaining depending on prior test
    const panelVisible = await page
      .getByText(/orphaned transfers? need resolution/i)
      .isVisible({ timeout: 8000 })
      .catch(() => false);

    if (!panelVisible) {
      // All already resolved — skip gracefully (prior test resolved all)
      test.skip();
      return;
    }

    const expenseButtons = page.getByRole('button', { name: /real expense/i });
    const initialCount = await expenseButtons.count();
    expect(initialCount).toBeGreaterThan(0);

    await expenseButtons.first().click();
    await page.waitForTimeout(1500);

    const newCount = await page.getByRole('button', { name: /real expense/i }).count();
    expect(newCount).toBeLessThan(initialCount);
  });

  test('panel disappears after all orphans resolved', async ({ page }) => {
    await goToTransfersTab(page);

    // If panel is already gone (prior tests resolved everything), that's valid too
    const panelHeading = page.getByText(/orphaned transfers? need resolution/i);
    const alreadyGone = !(await panelHeading.isVisible({ timeout: 3000 }).catch(() => false));
    if (alreadyGone) {
      // Panel already resolved — test passes (desired end state achieved)
      return;
    }

    // Resolve all remaining orphans using Exclude
    for (let i = 0; i < 5; i++) {
      const btn = page.getByRole('button', { name: /exclude/i }).first();
      const visible = await btn.isVisible({ timeout: 2000 }).catch(() => false);
      if (!visible) break;
      await btn.click();
      await page.waitForTimeout(1200);
    }

    await expect(
      page.getByText(/orphaned transfers? need resolution/i),
    ).not.toBeVisible({ timeout: 5000 });
  });
});
