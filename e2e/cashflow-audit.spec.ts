/**
 * Cashflow Section Audit
 * Audits: /cashflow/income, /cashflow/donations, /cashflow/expense, /cashflow/bank-interest
 *
 * Run with:
 *   pnpm exec playwright test --reporter=line --project=chromium e2e/cashflow-audit.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ─── Credentials (from site-audit.spec.ts) ────────────────────────────────────
const EMAIL = 'abdul@example.com';
const PASSWORD = 'Test@1234';
const BASE = 'http://localhost:3000';

// ─── Screenshot helpers ───────────────────────────────────────────────────────
const SCREENSHOT_DIR = path.join('e2e', 'reports', 'cashflow-audit');
function ensureDir() {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function screenshot(page: Page, name: string) {
  ensureDir();
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

// ─── Login helper ─────────────────────────────────────────────────────────────
async function login(page: Page) {
  await page.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/home`, { timeout: 15000 }).catch(() => {});
}

// ─── Findings store ───────────────────────────────────────────────────────────
interface Finding {
  page: string;
  category: 'load' | 'ui' | 'crud' | 'darkmode' | 'console' | 'dropdown';
  severity: 'ok' | 'warn' | 'error';
  detail: string;
}
const FINDINGS: Finding[] = [];
function record(page_: string, category: Finding['category'], severity: Finding['severity'], detail: string) {
  FINDINGS.push({ page: page_, category, severity, detail });
  console.log(`  [${severity.toUpperCase()}][${category}] ${detail}`);
}

// ─── Utility ──────────────────────────────────────────────────────────────────
async function collectConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(`PageError: ${err.message}`));
  return errors;
}

// ─── Dark-mode checks ────────────────────────────────────────────────────────
async function checkDarkMode(page: Page, pageName: string) {
  // Check if page is in dark mode
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  record(pageName, 'darkmode', 'ok', `Dark mode active: ${isDark}`);

  if (isDark) {
    // Check React Select dropdowns for light backgrounds
    const selectMenus = await page.locator('.react-select__menu, [class*="react-select__menu"]').count();
    if (selectMenus > 0) {
      const bg = await page.locator('.react-select__menu').first().evaluate(
        (el) => window.getComputedStyle(el).backgroundColor
      ).catch(() => 'unknown');
      record(pageName, 'darkmode', 'warn', `React Select menu background: ${bg}`);
    }

    // Check React Select control background
    const selectControls = await page.locator('.react-select__control, [class*="react-select__control"]').count();
    if (selectControls > 0) {
      const ctrlBg = await page.locator('.react-select__control').first().evaluate(
        (el) => window.getComputedStyle(el).backgroundColor
      ).catch(() => 'unknown');
      record(pageName, 'darkmode', 'warn', `React Select control background: ${ctrlBg}`);
    }

    // Check for labels with pointer-events issues
    const labels = await page.locator('label').all();
    for (const lbl of labels.slice(0, 5)) {
      const cursor = await lbl.evaluate(
        (el) => window.getComputedStyle(el).cursor
      ).catch(() => 'unknown');
      if (cursor === 'default' || cursor === 'auto') {
        const text = await lbl.innerText().catch(() => '');
        record(pageName, 'darkmode', 'warn', `Label "${text.slice(0, 30)}" cursor: ${cursor} (may look non-interactive)`);
      }
    }

    // Check for hardcoded white / light backgrounds in dark mode
    const lightBgEls = await page.locator('[class*="bg-white"], [class*="bg-gray-50"], [class*="bg-gray-100"]').count();
    if (lightBgEls > 0) {
      record(pageName, 'darkmode', 'warn', `${lightBgEls} element(s) with hardcoded light background classes in dark mode`);
    }
  }
}

// ─── React-Select dropdown test ───────────────────────────────────────────────
async function testReactSelectDropdown(page: Page, pageName: string, selectorIndex = 0) {
  const controls = page.locator('[class*="react-select__control"], .react-select__control');
  const count = await controls.count();
  record(pageName, 'dropdown', 'ok', `Found ${count} React Select control(s)`);

  if (count > selectorIndex) {
    const control = controls.nth(selectorIndex);
    await control.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);

    const menu = page.locator('[class*="react-select__menu"], .react-select__menu').first();
    const menuVisible = await menu.isVisible({ timeout: 3000 }).catch(() => false);
    if (menuVisible) {
      record(pageName, 'dropdown', 'ok', `React Select dropdown opened successfully`);

      const options = page.locator('[class*="react-select__option"], .react-select__option');
      const optionCount = await options.count();
      record(pageName, 'dropdown', 'ok', `Dropdown shows ${optionCount} option(s)`);

      if (optionCount > 0) {
        // Check background/text of first option
        const optBg = await options.first().evaluate(
          (el) => `bg:${window.getComputedStyle(el).backgroundColor} color:${window.getComputedStyle(el).color}`
        ).catch(() => 'unknown');
        record(pageName, 'darkmode', 'warn', `First dropdown option style: ${optBg}`);

        // Select the first option
        await options.first().click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(500);
        record(pageName, 'dropdown', 'ok', `Selected first option`);
      }
    } else {
      record(pageName, 'dropdown', 'warn', `React Select dropdown did NOT open`);
    }
  } else {
    record(pageName, 'dropdown', 'warn', `No React Select control found at index ${selectorIndex}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INCOME PAGE AUDIT
// ═══════════════════════════════════════════════════════════════════════════════
test('Audit: /cashflow/income', async ({ page }) => {
  test.setTimeout(90000);
  const PAGE_NAME = 'income';
  const consoleErrors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`PageError: ${e.message}`));

  console.log('\n══════════ INCOME PAGE AUDIT ══════════');

  await login(page);
  await page.goto(`${BASE}/cashflow/income`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  await screenshot(page, '01-income-initial');

  // ── 1. Load check ──────────────────────────────────────────────────────────
  const title = await page.title();
  record(PAGE_NAME, 'load', 'ok', `Page title: "${title}"`);

  const heading = page.getByRole('heading', { name: /income/i });
  const headingVisible = await heading.first().isVisible({ timeout: 5000 }).catch(() => false);
  record(PAGE_NAME, 'load', headingVisible ? 'ok' : 'warn', `Heading visible: ${headingVisible}`);

  const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
  if (bodyText.toLowerCase().includes('application error') || bodyText.toLowerCase().includes('an error occurred')) {
    record(PAGE_NAME, 'load', 'error', 'React error boundary triggered');
  } else {
    record(PAGE_NAME, 'load', 'ok', 'No React error boundary');
  }

  // ── 2. Dark mode ──────────────────────────────────────────────────────────
  await checkDarkMode(page, PAGE_NAME);

  // ── 3. Fiscal year dropdown ───────────────────────────────────────────────
  record(PAGE_NAME, 'dropdown', 'ok', '--- Testing fiscal year React Select ---');
  await testReactSelectDropdown(page, PAGE_NAME, 0);
  await page.waitForTimeout(1000);
  await screenshot(page, '02-income-after-year-select');

  // ── 4. CRUD – Add Entry ───────────────────────────────────────────────────
  record(PAGE_NAME, 'crud', 'ok', '--- Testing CRUD ---');
  const addButton = page.locator('button').filter({ hasText: /^\+\s*Add Entry$|^Add Entry$|\+/ }).first();
  const addVisible = await addButton.isVisible({ timeout: 5000 }).catch(() => false);
  record(PAGE_NAME, 'crud', addVisible ? 'ok' : 'warn', `Add Entry button visible: ${addVisible}`);

  if (addVisible) {
    await addButton.click();
    await page.waitForTimeout(1000);
    await screenshot(page, '03-income-add-row-clicked');

    // Look for an inline row with inputs
    const dateInputs = page.locator('input[type="date"]');
    const dateVisible = await dateInputs.first().isVisible({ timeout: 3000 }).catch(() => false);
    record(PAGE_NAME, 'crud', dateVisible ? 'ok' : 'warn', `Date input appeared: ${dateVisible}`);

    if (dateVisible) {
      await dateInputs.first().fill('2024-06-15');
    }

    // Amount / numeric input
    const numInputs = page.locator('input[type="number"], input[inputmode="decimal"]');
    const numVisible = await numInputs.first().isVisible({ timeout: 3000 }).catch(() => false);
    if (numVisible) {
      await numInputs.first().fill('9999');
      record(PAGE_NAME, 'crud', 'ok', 'Filled amount: 9999');
    }

    // Source / text inputs
    const textInputs = page.locator('input[type="text"]');
    const textCount = await textInputs.count();
    if (textCount > 0) {
      await textInputs.first().fill('Audit Test Source');
      record(PAGE_NAME, 'crud', 'ok', 'Filled text input');
    }

    await screenshot(page, '04-income-row-filled');

    // Save via check/save button
    const saveBtn = page.locator('button[aria-label*="save" i], button[aria-label*="confirm" i], button svg[class*="check" i]').first();
    const saveBtnAlt = page.locator('button').filter({ hasText: /save/i }).first();
    const checkIconBtn = page.locator('button').filter({ has: page.locator('svg') }).nth(0);

    let saved = false;
    if (await saveBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await saveBtn.click();
      saved = true;
    } else if (await saveBtnAlt.isVisible({ timeout: 1000 }).catch(() => false)) {
      await saveBtnAlt.click();
      saved = true;
    }

    await page.waitForTimeout(1500);
    await screenshot(page, '05-income-after-save');
    record(PAGE_NAME, 'crud', saved ? 'ok' : 'warn', `Save button found and clicked: ${saved}`);
  }

  // ── Edit / Delete ─────────────────────────────────────────────────────────
  await page.waitForTimeout(1000);

  const editBtns = page.locator('button[aria-label*="edit" i], button[aria-label*="Edit" i]');
  const penBtns = page.locator('button').filter({ has: page.locator('[class*="pen" i], [class*="pencil" i]') });
  const editCount = await editBtns.count();
  const penCount = await penBtns.count();
  record(PAGE_NAME, 'crud', 'ok', `Edit buttons found: aria=${editCount}, pen-icon=${penCount}`);

  if (editCount > 0) {
    await editBtns.first().click();
    await page.waitForTimeout(800);
    const numI = page.locator('input[type="number"], input[inputmode="decimal"]').first();
    if (await numI.isVisible({ timeout: 2000 }).catch(() => false)) {
      await numI.fill('11111');
      record(PAGE_NAME, 'crud', 'ok', 'Edited amount in row');
    }
    await screenshot(page, '06-income-editing-row');

    const saveEditBtn = page.locator('button[aria-label*="save" i], button[aria-label*="confirm" i]').first();
    if (await saveEditBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await saveEditBtn.click();
      await page.waitForTimeout(1000);
    }
  }

  const delBtns = page.locator('button[aria-label*="delete" i], button[aria-label*="Delete" i]');
  const delCount = await delBtns.count();
  record(PAGE_NAME, 'crud', 'ok', `Delete buttons found: ${delCount}`);

  if (delCount > 0) {
    await delBtns.first().click();
    await page.waitForTimeout(500);
    // Handle confirm dialog
    page.on('dialog', async (d) => { await d.accept(); });
    await page.waitForTimeout(1500);
    await screenshot(page, '07-income-after-delete');
    record(PAGE_NAME, 'crud', 'ok', 'Delete button clicked');
  }

  // ── 5. Console errors ─────────────────────────────────────────────────────
  consoleErrors.forEach((e) => record(PAGE_NAME, 'console', 'error', e.slice(0, 300)));
  if (consoleErrors.length === 0) record(PAGE_NAME, 'console', 'ok', 'No console errors');
});

// ═══════════════════════════════════════════════════════════════════════════════
// DONATIONS PAGE AUDIT
// ═══════════════════════════════════════════════════════════════════════════════
test('Audit: /cashflow/donations', async ({ page }) => {
  test.setTimeout(90000);
  const PAGE_NAME = 'donations';
  const consoleErrors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`PageError: ${e.message}`));

  console.log('\n══════════ DONATIONS PAGE AUDIT ══════════');

  await login(page);
  await page.goto(`${BASE}/cashflow/donations`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  await screenshot(page, '10-donations-initial');

  // ── 1. Load check ─────────────────────────────────────────────────────────
  const title = await page.title();
  record(PAGE_NAME, 'load', 'ok', `Page title: "${title}"`);

  const heading = page.getByRole('heading', { name: /donation/i });
  const headingVisible = await heading.first().isVisible({ timeout: 5000 }).catch(() => false);
  record(PAGE_NAME, 'load', headingVisible ? 'ok' : 'warn', `Heading visible: ${headingVisible}`);

  const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
  if (bodyText.toLowerCase().includes('application error')) {
    record(PAGE_NAME, 'load', 'error', 'React error boundary triggered');
  } else {
    record(PAGE_NAME, 'load', 'ok', 'No React error boundary');
  }

  // ── 2. Dark mode ──────────────────────────────────────────────────────────
  await checkDarkMode(page, PAGE_NAME);

  // ── 3. Fiscal year dropdown ───────────────────────────────────────────────
  record(PAGE_NAME, 'dropdown', 'ok', '--- Testing fiscal year React Select ---');
  await testReactSelectDropdown(page, PAGE_NAME, 0);
  await page.waitForTimeout(1000);
  await screenshot(page, '11-donations-after-year-select');

  // ── 4. Table visibility ───────────────────────────────────────────────────
  const table = page.locator('table, [role="grid"], tbody').first();
  const tableVisible = await table.isVisible({ timeout: 3000 }).catch(() => false);
  record(PAGE_NAME, 'ui', tableVisible ? 'ok' : 'warn', `Data table visible: ${tableVisible}`);

  // ── 5. CRUD – Add ─────────────────────────────────────────────────────────
  record(PAGE_NAME, 'crud', 'ok', '--- Testing CRUD ---');

  // Look for + button (icon button, not text)
  const addBtn = page.locator('button').filter({ hasText: /^\+$/ }).first();
  const addBtnAlt = page.locator('button[aria-label*="add" i]').first();
  const addVisible = await addBtn.isVisible({ timeout: 3000 }).catch(() => false);
  const addAltVisible = await addBtnAlt.isVisible({ timeout: 3000 }).catch(() => false);
  record(PAGE_NAME, 'crud', (addVisible || addAltVisible) ? 'ok' : 'warn', `Add button visible: icon=${addVisible}, aria=${addAltVisible}`);

  const clickableAdd = addVisible ? addBtn : (addAltVisible ? addBtnAlt : null);

  if (clickableAdd) {
    await clickableAdd.click();
    await page.waitForTimeout(1000);
    await screenshot(page, '12-donations-add-row');

    const dateInputs = page.locator('input[type="date"]');
    if (await dateInputs.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await dateInputs.first().fill('2024-06-15');
      record(PAGE_NAME, 'crud', 'ok', 'Filled date');
    }

    const numInputs = page.locator('input[type="number"], input[inputmode="decimal"]');
    if (await numInputs.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await numInputs.first().fill('250');
      record(PAGE_NAME, 'crud', 'ok', 'Filled amount: 250');
    }

    await screenshot(page, '13-donations-row-filled');

    const saveBtn = page.locator('button[aria-label*="save" i], button[aria-label*="confirm" i]').first();
    const saveBtnText = page.locator('button').filter({ hasText: /save/i }).first();
    if (await saveBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await saveBtn.click();
    } else if (await saveBtnText.isVisible({ timeout: 1000 }).catch(() => false)) {
      await saveBtnText.click();
    }
    await page.waitForTimeout(1500);
    await screenshot(page, '14-donations-after-save');
  }

  // Edit
  const editBtns = page.locator('button[aria-label*="edit" i]');
  if (await editBtns.first().isVisible({ timeout: 2000 }).catch(() => false)) {
    await editBtns.first().click();
    await page.waitForTimeout(800);
    await screenshot(page, '15-donations-editing');
    const saveBtn = page.locator('button[aria-label*="save" i], button[aria-label*="confirm" i]').first();
    if (await saveBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(1000);
    }
    record(PAGE_NAME, 'crud', 'ok', 'Edit button clicked and save attempted');
  }

  // Delete
  const delBtns = page.locator('button[aria-label*="delete" i]');
  const delCount = await delBtns.count();
  record(PAGE_NAME, 'crud', 'ok', `Delete buttons found: ${delCount}`);
  if (delCount > 0) {
    await delBtns.first().click();
    page.on('dialog', async (d) => { await d.accept(); });
    await page.waitForTimeout(1500);
    await screenshot(page, '16-donations-after-delete');
    record(PAGE_NAME, 'crud', 'ok', 'Delete button clicked');
  }

  // ── 6. Console errors ─────────────────────────────────────────────────────
  consoleErrors.forEach((e) => record(PAGE_NAME, 'console', 'error', e.slice(0, 300)));
  if (consoleErrors.length === 0) record(PAGE_NAME, 'console', 'ok', 'No console errors');
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPENSE PAGE AUDIT
// ═══════════════════════════════════════════════════════════════════════════════
test('Audit: /cashflow/expense', async ({ page }) => {
  test.setTimeout(90000);
  const PAGE_NAME = 'expense';
  const consoleErrors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`PageError: ${e.message}`));

  console.log('\n══════════ EXPENSE PAGE AUDIT ══════════');

  await login(page);
  await page.goto(`${BASE}/cashflow/expense`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  await screenshot(page, '20-expense-initial');

  // ── 1. Load check ─────────────────────────────────────────────────────────
  const title = await page.title();
  record(PAGE_NAME, 'load', 'ok', `Page title: "${title}"`);

  const heading = page.getByRole('heading', { name: /expense/i });
  const headingVisible = await heading.first().isVisible({ timeout: 5000 }).catch(() => false);
  record(PAGE_NAME, 'load', headingVisible ? 'ok' : 'warn', `Heading visible: ${headingVisible}`);

  const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
  if (bodyText.toLowerCase().includes('application error')) {
    record(PAGE_NAME, 'load', 'error', 'React error boundary triggered');
  } else {
    record(PAGE_NAME, 'load', 'ok', 'No React error boundary');
  }

  // ── 2. Dark mode ──────────────────────────────────────────────────────────
  await checkDarkMode(page, PAGE_NAME);

  // ── 3. Fiscal year dropdown ───────────────────────────────────────────────
  record(PAGE_NAME, 'dropdown', 'ok', '--- Testing fiscal year React Select ---');
  await testReactSelectDropdown(page, PAGE_NAME, 0);
  await page.waitForTimeout(1000);
  await screenshot(page, '21-expense-after-year-select');

  // ── 4. Table visibility ───────────────────────────────────────────────────
  const table = page.locator('table, [role="grid"], tbody').first();
  const tableVisible = await table.isVisible({ timeout: 3000 }).catch(() => false);
  record(PAGE_NAME, 'ui', tableVisible ? 'ok' : 'warn', `Expense table visible: ${tableVisible}`);

  // ── 5. Category Breakdown Modal ───────────────────────────────────────────
  record(PAGE_NAME, 'crud', 'ok', '--- Testing Category Breakdown Modal ---');

  // Find the category breakdown / list icon button on any row
  const listIconBtns = page.locator('button[aria-label*="breakdown" i], button[aria-label*="category" i], button[aria-label*="detail" i]');
  const listCount = await listIconBtns.count();

  // Also look for icon buttons in table rows (list/detail icons are often SVGs inside buttons)
  const tableRowBtns = page.locator('tbody tr button, [role="row"] button');
  const rowBtnCount = await tableRowBtns.count();
  record(PAGE_NAME, 'crud', 'ok', `Category/list icon buttons (aria): ${listCount}, table row buttons: ${rowBtnCount}`);

  let modalOpened = false;

  if (listCount > 0) {
    await listIconBtns.first().click();
    await page.waitForTimeout(1000);
    modalOpened = true;
  } else if (rowBtnCount > 0) {
    // Try clicking the first row button (likely the breakdown icon)
    await tableRowBtns.first().click();
    await page.waitForTimeout(1000);

    // Check if modal appeared
    const modal = page.locator('[role="dialog"], .modal, [class*="modal"]');
    modalOpened = await modal.first().isVisible({ timeout: 2000 }).catch(() => false);
    if (!modalOpened) {
      // Try the second button (may be different action)
      if (rowBtnCount > 1) {
        await tableRowBtns.nth(1).click();
        await page.waitForTimeout(1000);
        modalOpened = await modal.first().isVisible({ timeout: 2000 }).catch(() => false);
      }
    }
  }

  await screenshot(page, '22-expense-after-breakdown-click');
  record(PAGE_NAME, 'crud', modalOpened ? 'ok' : 'warn', `Category breakdown modal opened: ${modalOpened}`);

  if (modalOpened) {
    await screenshot(page, '23-expense-breakdown-modal-open');

    // Test React Select inside modal
    const modalSelectControls = page.locator('[role="dialog"] [class*="react-select__control"], [role="dialog"] .react-select__control');
    const modalSelectCount = await modalSelectControls.count();
    record(PAGE_NAME, 'crud', 'ok', `React Select controls in modal: ${modalSelectCount}`);

    // Try to add an expense entry in the modal
    const modalAddBtn = page.locator('[role="dialog"] button[aria-label*="add" i], [role="dialog"] button').filter({ hasText: /^\+$/ }).first();
    const modalAddBtnAlt = page.locator('[role="dialog"] button').filter({ hasText: /add/i }).first();
    const addIconBtn = page.locator('[role="dialog"] button[aria-label*="add" i]').first();

    // Look for add/+ button within the modal
    const addBtnInModal = page.locator('[role="dialog"]').locator('button').filter({ hasText: /^\+$/ }).first();
    const addBtnInModalVisible = await addBtnInModal.isVisible({ timeout: 2000 }).catch(() => false);

    if (addBtnInModalVisible) {
      await addBtnInModal.click();
      await page.waitForTimeout(500);
      record(PAGE_NAME, 'crud', 'ok', 'Add button in modal clicked');
    }

    // Fill category select
    if (modalSelectCount > 0) {
      await modalSelectControls.first().click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(500);
      const optionsInModal = page.locator('[role="dialog"] [class*="react-select__option"], [class*="react-select__menu"]');
      const optCount = await optionsInModal.count();
      if (optCount > 0) {
        await optionsInModal.first().click().catch(() => {});
        record(PAGE_NAME, 'crud', 'ok', `Selected category from dropdown (${optCount} options)`);
      }
    }

    // Fill amount
    const modalNumInputs = page.locator('[role="dialog"] input[type="number"], [role="dialog"] input[inputmode="decimal"]');
    if (await modalNumInputs.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await modalNumInputs.first().fill('333');
      record(PAGE_NAME, 'crud', 'ok', 'Filled expense amount: 333');
    }

    await screenshot(page, '24-expense-modal-filled');

    // Check button (save)
    const checkBtn = page.locator('[role="dialog"] button[aria-label*="save" i], [role="dialog"] button[aria-label*="confirm" i], [role="dialog"] button[aria-label*="check" i]').first();
    if (await checkBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await checkBtn.click();
      await page.waitForTimeout(1000);
      record(PAGE_NAME, 'crud', 'ok', 'Saved expense entry in modal');
    }

    await screenshot(page, '25-expense-modal-after-save');

    // Try edit
    const modalEditBtns = page.locator('[role="dialog"] button[aria-label*="edit" i]');
    if (await modalEditBtns.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await modalEditBtns.first().click();
      await page.waitForTimeout(800);
      record(PAGE_NAME, 'crud', 'ok', 'Edit button in modal clicked');
      await screenshot(page, '26-expense-modal-edit');
    }

    // Try delete
    const modalDelBtns = page.locator('[role="dialog"] button[aria-label*="delete" i], [role="dialog"] button[aria-label*="trash" i]');
    if (await modalDelBtns.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await modalDelBtns.first().click();
      page.on('dialog', async (d) => { await d.accept(); });
      await page.waitForTimeout(1500);
      record(PAGE_NAME, 'crud', 'ok', 'Delete button in modal clicked');
      await screenshot(page, '27-expense-modal-delete');
    }

    // Check modal dark mode
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (isDark) {
      const modalBg = await page.locator('[role="dialog"]').first().evaluate(
        (el) => window.getComputedStyle(el).backgroundColor
      ).catch(() => 'unknown');
      record(PAGE_NAME, 'darkmode', 'warn', `Modal background color: ${modalBg}`);
    }

    // Close modal
    const closeBtn = page.locator('[role="dialog"] button[aria-label*="close" i], [role="dialog"] button').filter({ hasText: /close|cancel|×/i }).first();
    if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(500);
  }

  // ── 6. Console errors ─────────────────────────────────────────────────────
  consoleErrors.forEach((e) => record(PAGE_NAME, 'console', 'error', e.slice(0, 300)));
  if (consoleErrors.length === 0) record(PAGE_NAME, 'console', 'ok', 'No console errors');
});

// ═══════════════════════════════════════════════════════════════════════════════
// BANK INTEREST PAGE AUDIT
// ═══════════════════════════════════════════════════════════════════════════════
test('Audit: /cashflow/bank-interest', async ({ page }) => {
  test.setTimeout(90000);
  const PAGE_NAME = 'bank-interest';
  const consoleErrors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`PageError: ${e.message}`));

  console.log('\n══════════ BANK INTEREST PAGE AUDIT ══════════');

  await login(page);
  await page.goto(`${BASE}/cashflow/bank-interest`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  await screenshot(page, '30-bank-interest-initial');

  // ── 1. Load check ─────────────────────────────────────────────────────────
  const title = await page.title();
  record(PAGE_NAME, 'load', 'ok', `Page title: "${title}"`);

  const heading = page.getByRole('heading', { name: /bank.interest|interest/i });
  const headingVisible = await heading.first().isVisible({ timeout: 5000 }).catch(() => false);
  record(PAGE_NAME, 'load', headingVisible ? 'ok' : 'warn', `Heading visible: ${headingVisible}`);

  const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
  if (bodyText.toLowerCase().includes('application error')) {
    record(PAGE_NAME, 'load', 'error', 'React error boundary triggered');
  } else {
    record(PAGE_NAME, 'load', 'ok', 'No React error boundary');
  }

  // ── 2. Dark mode ──────────────────────────────────────────────────────────
  await checkDarkMode(page, PAGE_NAME);

  // ── 3. Count React Selects (bank + year dropdowns) ────────────────────────
  const selectControls = page.locator('[class*="react-select__control"], .react-select__control');
  const selectCount = await selectControls.count();
  record(PAGE_NAME, 'dropdown', 'ok', `Found ${selectCount} React Select control(s) on page`);

  // Test bank selector (first dropdown)
  record(PAGE_NAME, 'dropdown', 'ok', '--- Testing Bank selector ---');
  await testReactSelectDropdown(page, PAGE_NAME, 0);
  await page.waitForTimeout(1500);
  await screenshot(page, '31-bank-interest-after-bank-select');

  // Test year selector (second dropdown)
  if (selectCount > 1) {
    record(PAGE_NAME, 'dropdown', 'ok', '--- Testing Year selector ---');
    await testReactSelectDropdown(page, PAGE_NAME, 1);
    await page.waitForTimeout(1500);
    await screenshot(page, '32-bank-interest-after-year-select');
  }

  // ── 4. Table visibility ───────────────────────────────────────────────────
  const table = page.locator('table, [role="grid"], tbody').first();
  const tableVisible = await table.isVisible({ timeout: 3000 }).catch(() => false);
  record(PAGE_NAME, 'ui', tableVisible ? 'ok' : 'warn', `Bank interest table visible: ${tableVisible}`);

  // ── 5. Payment History Modal ──────────────────────────────────────────────
  record(PAGE_NAME, 'crud', 'ok', '--- Testing Payment History Modal ---');

  // The payment history link icon is in each row
  const historyBtns = page.locator('button[aria-label*="payment" i], button[aria-label*="history" i], button[aria-label*="link" i]');
  const historyCount = await historyBtns.count();

  // Also try row buttons
  const rowBtns = page.locator('tbody tr button, [role="row"] button');
  const rowBtnCount = await rowBtns.count();
  record(PAGE_NAME, 'crud', 'ok', `Payment history buttons (aria): ${historyCount}, row buttons: ${rowBtnCount}`);

  let modalOpened = false;

  if (historyCount > 0) {
    await historyBtns.first().click();
    await page.waitForTimeout(1000);
    const modal = page.locator('[role="dialog"]');
    modalOpened = await modal.first().isVisible({ timeout: 3000 }).catch(() => false);
  } else if (rowBtnCount > 0) {
    // Try each row button until a modal opens
    for (let i = 0; i < Math.min(rowBtnCount, 5); i++) {
      await rowBtns.nth(i).click();
      await page.waitForTimeout(800);
      const modal = page.locator('[role="dialog"]');
      modalOpened = await modal.first().isVisible({ timeout: 2000 }).catch(() => false);
      if (modalOpened) {
        record(PAGE_NAME, 'crud', 'ok', `Payment history modal opened via row button #${i}`);
        break;
      }
    }
  }

  await screenshot(page, '33-bank-interest-after-history-click');
  record(PAGE_NAME, 'crud', modalOpened ? 'ok' : 'warn', `Payment history modal opened: ${modalOpened}`);

  if (modalOpened) {
    await screenshot(page, '34-bank-interest-payment-modal-open');

    // Check modal dark mode
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (isDark) {
      const modalBg = await page.locator('[role="dialog"]').first().evaluate(
        (el) => window.getComputedStyle(el).backgroundColor
      ).catch(() => 'unknown');
      record(PAGE_NAME, 'darkmode', 'warn', `Payment modal background color: ${modalBg}`);
    }

    // Add payment
    const addBtnInModal = page.locator('[role="dialog"]').locator('button[aria-label*="add" i]').first();
    const addBtnInModalAlt = page.locator('[role="dialog"]').locator('button').filter({ hasText: /add|\+/ }).first();
    const hasAddBtn = await addBtnInModal.isVisible({ timeout: 2000 }).catch(() => false);
    const hasAddBtnAlt = await addBtnInModalAlt.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasAddBtn) {
      await addBtnInModal.click();
    } else if (hasAddBtnAlt) {
      await addBtnInModalAlt.click();
    }

    await page.waitForTimeout(500);
    await screenshot(page, '35-bank-interest-payment-add-clicked');

    // Fill in date via DatePickerDialog or date input
    const dateInputs = page.locator('[role="dialog"] input[type="date"], [role="dialog"] input[placeholder*="date" i]');
    const dateVisible = await dateInputs.first().isVisible({ timeout: 2000 }).catch(() => false);
    if (dateVisible) {
      await dateInputs.first().fill('2024-06-15');
      record(PAGE_NAME, 'crud', 'ok', 'Filled date in payment modal');
    }

    // DatePickerDialog might be a button/custom component
    const datePicker = page.locator('[role="dialog"] button[aria-label*="date" i], [role="dialog"] [class*="datepicker" i]').first();
    if (!dateVisible && await datePicker.isVisible({ timeout: 1000 }).catch(() => false)) {
      record(PAGE_NAME, 'crud', 'warn', 'DatePickerDialog detected (custom component, not a plain input)');
    }

    // Fill amount
    const amountInputs = page.locator('[role="dialog"] input[type="number"], [role="dialog"] input[inputmode="decimal"]');
    if (await amountInputs.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await amountInputs.first().fill('150.50');
      record(PAGE_NAME, 'crud', 'ok', 'Filled payment amount: 150.50');
    }

    await screenshot(page, '36-bank-interest-payment-filled');

    // Save (check icon button)
    const saveBtn = page.locator('[role="dialog"] button[aria-label*="save" i], [role="dialog"] button[aria-label*="confirm" i], [role="dialog"] button[aria-label*="check" i]').first();
    if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(1000);
      record(PAGE_NAME, 'crud', 'ok', 'Saved payment');
    }

    await screenshot(page, '37-bank-interest-payment-saved');

    // Edit the added payment
    const editBtns = page.locator('[role="dialog"] button[aria-label*="edit" i]');
    if (await editBtns.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await editBtns.first().click();
      await page.waitForTimeout(800);
      record(PAGE_NAME, 'crud', 'ok', 'Edit button in payment modal clicked');
      const amtInput = page.locator('[role="dialog"] input[type="number"], [role="dialog"] input[inputmode="decimal"]');
      if (await amtInput.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await amtInput.first().fill('200.00');
        record(PAGE_NAME, 'crud', 'ok', 'Updated payment amount to 200.00');
      }
      const confirmBtn = page.locator('[role="dialog"] button[aria-label*="save" i], [role="dialog"] button[aria-label*="confirm" i]').first();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(1000);
        record(PAGE_NAME, 'crud', 'ok', 'Saved edited payment');
      }
      await screenshot(page, '38-bank-interest-payment-edited');
    }

    // Delete payment
    const delBtns = page.locator('[role="dialog"] button[aria-label*="delete" i], [role="dialog"] button[aria-label*="trash" i]');
    if (await delBtns.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await delBtns.first().click();
      page.on('dialog', async (d) => { await d.accept(); });
      await page.waitForTimeout(1500);
      record(PAGE_NAME, 'crud', 'ok', 'Delete payment clicked');
      await screenshot(page, '39-bank-interest-payment-deleted');
    }

    // Close modal
    const closeBtn = page.locator('[role="dialog"] button[aria-label*="close" i]').first();
    if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(500);
  }

  // ── 6. Console errors ─────────────────────────────────────────────────────
  consoleErrors.forEach((e) => record(PAGE_NAME, 'console', 'error', e.slice(0, 300)));
  if (consoleErrors.length === 0) record(PAGE_NAME, 'console', 'ok', 'No console errors');
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUMMARY REPORT
// ═══════════════════════════════════════════════════════════════════════════════
test('Cashflow Audit – Write Summary Report', async () => {
  ensureDir();

  // Write JSON findings
  const jsonPath = path.join(SCREENSHOT_DIR, 'findings.json');
  fs.writeFileSync(jsonPath, JSON.stringify(FINDINGS, null, 2));

  // Build markdown report
  const errors = FINDINGS.filter((f) => f.severity === 'error');
  const warnings = FINDINGS.filter((f) => f.severity === 'warn');
  const okItems = FINDINGS.filter((f) => f.severity === 'ok');

  const groupBy = (items: Finding[], key: keyof Finding) =>
    items.reduce<Record<string, Finding[]>>((acc, item) => {
      const k = String(item[key]);
      acc[k] = acc[k] ?? [];
      acc[k].push(item);
      return acc;
    }, {});

  const byPage = groupBy(FINDINGS, 'page');

  let md = `# Cashflow Section Audit Report\n\n`;
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += `## Summary\n\n`;
  md += `| Severity | Count |\n|---|---|\n`;
  md += `| ✅ OK | ${okItems.length} |\n`;
  md += `| ⚠️ WARN | ${warnings.length} |\n`;
  md += `| ❌ ERROR | ${errors.length} |\n\n`;

  md += `## Findings by Page\n\n`;
  for (const [pg, findings] of Object.entries(byPage)) {
    md += `### ${pg}\n\n`;
    const cats = groupBy(findings, 'category');
    for (const [cat, items] of Object.entries(cats)) {
      md += `**${cat}**\n\n`;
      items.forEach((f) => {
        const icon = f.severity === 'ok' ? '✅' : f.severity === 'warn' ? '⚠️' : '❌';
        md += `- ${icon} ${f.detail}\n`;
      });
      md += '\n';
    }
  }

  if (errors.length > 0) {
    md += `## ❌ All Errors\n\n`;
    errors.forEach((f) => md += `- [${f.page}][${f.category}] ${f.detail}\n`);
    md += '\n';
  }

  if (warnings.length > 0) {
    md += `## ⚠️ All Warnings\n\n`;
    warnings.forEach((f) => md += `- [${f.page}][${f.category}] ${f.detail}\n`);
    md += '\n';
  }

  const mdPath = path.join(SCREENSHOT_DIR, 'audit-report.md');
  fs.writeFileSync(mdPath, md);

  console.log(`\n📄 Audit report: ${mdPath}`);
  console.log(`📊 Findings JSON: ${jsonPath}`);
  console.log(`\n📸 Screenshots: ${SCREENSHOT_DIR}`);
  console.log(`\n=== SUMMARY ===`);
  console.log(`  ✅ OK:    ${okItems.length}`);
  console.log(`  ⚠️  WARN:  ${warnings.length}`);
  console.log(`  ❌ ERROR: ${errors.length}`);

  expect(true).toBe(true);
});
