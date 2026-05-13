/**
 * Site Audit Spec
 * Navigates every page of the application, collecting console errors,
 * network failures, page crashes, and layout notes.
 *
 * Run with:
 *   pnpm exec playwright test e2e/site-audit.spec.ts --project=chromium
 */

import { test, expect, type Page, type Browser } from '@playwright/test';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PageAuditResult {
  path: string;
  label: string;
  title: string;
  consoleErrors: string[];
  networkErrors: string[];
  pageErrors: string[];
  redirectedTo?: string;
  loadStatus: 'ok' | 'error' | 'redirect' | 'auth-redirect';
  notes: string[];
}

// ─── Routes ───────────────────────────────────────────────────────────────────
const ROUTES = [
  { path: '/', label: 'Root / Landing' },
  { path: '/auth/login', label: 'Login' },
  { path: '/auth/register', label: 'Register' },
  { path: '/home', label: 'Home / Dashboard' },
  { path: '/cashflow/income', label: 'Cashflow – Income' },
  { path: '/cashflow/expense', label: 'Cashflow – Expense' },
  { path: '/cashflow/donations', label: 'Cashflow – Donations' },
  { path: '/cashflow/bank-interest', label: 'Cashflow – Bank Interest' },
  { path: '/cashflow/bank', label: 'Cashflow – Bank (CSV Import)' },
  { path: '/cashflow/stocks', label: 'Cashflow – Stocks' },
  { path: '/relation/individual', label: 'Relations – Individual' },
  { path: '/relation/business', label: 'Relations – Business' },
  { path: '/zakat', label: 'Zakat' },
  { path: '/settings/profile', label: 'Settings – Profile' },
  { path: '/settings/banks', label: 'Settings – Banks' },
  { path: '/settings/calendar', label: 'Settings – Calendar' },
  { path: '/settings/ai-usage', label: 'Settings – AI Usage' },
  { path: '/reports/income-summary', label: 'Reports – Income Summary' },
];

const EMAIL = 'abdul@example.com';
const PASSWORD = 'Test@1234';
const BASE = 'http://localhost:3000';

// ─── Login helper ─────────────────────────────────────────────────────────────
async function loginWith(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  try {
    await page.waitForURL(`${BASE}/home`, { timeout: 12000 });
  } catch {
    // may redirect elsewhere – continue anyway
  }
  return page;
}

// ─── Single-page auditor ──────────────────────────────────────────────────────
async function auditOnePage(
  browser: Browser,
  route: { path: string; label: string },
): Promise<PageAuditResult> {
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];
  const pageErrors: string[] = [];
  const notes: string[] = [];
  let loadStatus: PageAuditResult['loadStatus'] = 'ok';
  let title = '';
  let redirectedTo: string | undefined;

  // Fresh page per route to avoid crash bleed-over
  let page: Page;
  try {
    page = await loginWith(browser);
  } catch (err) {
    return {
      path: route.path,
      label: route.label,
      title: '',
      consoleErrors: [],
      networkErrors: [],
      pageErrors: [],
      loadStatus: 'error',
      notes: [
        `Could not create page: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  // Attach listeners
  const onConsole = (msg: import('@playwright/test').ConsoleMessage) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  };
  const onRequestFailed = (req: import('@playwright/test').Request) => {
    const f = req.failure();
    if (f) networkErrors.push(`${req.method()} ${req.url()} → ${f.errorText}`);
  };
  const onResponse = (res: import('@playwright/test').Response) => {
    if (res.status() >= 400 && res.url().includes('/api/'))
      networkErrors.push(`HTTP ${res.status()} ${res.url()}`);
  };
  const onPageError = (err: Error) =>
    pageErrors.push(`${err.name}: ${err.message}`);

  page.on('console', onConsole);
  page.on('requestfailed', onRequestFailed);
  page.on('response', onResponse);
  page.on('pageerror', onPageError);

  try {
    const response = await page.goto(`${BASE}${route.path}`, {
      waitUntil: 'networkidle',
      timeout: 20000,
    });

    const finalUrl = page.url();
    if (finalUrl !== `${BASE}${route.path}`) {
      redirectedTo = finalUrl;
      loadStatus = finalUrl.includes('/auth/login') ? 'auth-redirect' : 'redirect';
    }

    if (response && response.status() >= 400) {
      loadStatus = 'error';
      notes.push(`HTTP ${response.status()} on page load`);
    }

    // Wait for async renders / toasts
    await page.waitForTimeout(2500);

    title = await page.title().catch(() => '');

    const bodyText = await page
      .locator('body')
      .innerText({ timeout: 3000 })
      .catch(() => '');

    if (
      bodyText.toLowerCase().includes('application error') ||
      bodyText.toLowerCase().includes('an error occurred in')
    ) {
      loadStatus = 'error';
      notes.push('Next.js application error boundary triggered');
    }

    if (bodyText.match(/\b404\b/) && bodyText.toLowerCase().includes('not found')) {
      loadStatus = 'error';
      notes.push('404 – page not found');
    }

    // Missing <main>
    const mainCount = await page.locator('main').count().catch(() => 0);
    if (mainCount === 0) notes.push('No <main> element – possible layout issue');

    // Hydration warnings
    const hydration = consoleErrors.find(
      (e) =>
        e.toLowerCase().includes('hydrat') ||
        e.toLowerCase().includes('did not match'),
    );
    if (hydration) notes.push('React hydration mismatch detected');

    // Blank/empty page body
    if (bodyText.trim().length < 20) notes.push('Page body appears empty or near-empty');
  } catch (err) {
    loadStatus = 'error';
    notes.push(
      `Navigation failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    title = title || '';
  }

  try {
    await page.context().close();
  } catch {
    // already closed
  }

  return {
    path: route.path,
    label: route.label,
    title,
    consoleErrors,
    networkErrors,
    pageErrors,
    redirectedTo,
    loadStatus,
    notes,
  };
}

// ─── The test ─────────────────────────────────────────────────────────────────
test('Full site audit – collect results', async ({ browser }) => {
  test.setTimeout(600000); // 10 min

  const results: PageAuditResult[] = [];

  for (const route of ROUTES) {
    console.log(`\n🔍 ${route.label} (${route.path})`);
    const r = await auditOnePage(browser, route);
    results.push(r);

    const errCount = r.consoleErrors.length + r.networkErrors.length + r.pageErrors.length;
    const icon =
      r.loadStatus === 'ok'
        ? '✅'
        : r.loadStatus === 'auth-redirect'
          ? '🔐'
          : r.loadStatus === 'redirect'
            ? '↪️ '
            : '❌';

    console.log(`  ${icon} ${r.loadStatus.toUpperCase()} | "${r.title}" | ${errCount} error(s)`);
    if (r.redirectedTo) console.log(`     ↳ → ${r.redirectedTo}`);
    r.consoleErrors.slice(0, 3).forEach((e) => console.log(`  [console] ${e.slice(0, 200)}`));
    r.networkErrors.slice(0, 5).forEach((e) => console.log(`  [network] ${e}`));
    r.pageErrors.slice(0, 2).forEach((e) => console.log(`  [page error] ${e.slice(0, 300)}`));
    r.notes.forEach((n) => console.log(`  [note] ${n}`));
  }

  // Persist results so the markdown step can read them
  const fs = await import('fs');
  fs.writeFileSync('e2e/audit-results.json', JSON.stringify(results, null, 2));
  console.log('\n📄 Results saved to e2e/audit-results.json');

  expect(results.length).toBe(ROUTES.length);
});
