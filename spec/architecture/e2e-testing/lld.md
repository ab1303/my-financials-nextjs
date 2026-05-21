# E2E Testing — Low-Level Design

## Playwright Setup

### Configuration Files

**File**: `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

### Test File Structure

```
e2e/
  ├── fixtures/
  │   ├── auth.fixture.ts       # Login/logout helpers
  │   └── data.fixture.ts       # Test data creation
  ├── pages/
  │   ├── dashboard.page.ts     # Page Object Model
  │   ├── transactions.page.ts
  │   └── ...
  ├── auth.spec.ts             # Auth user flows
  ├── transactions.spec.ts      # Transaction workflows
  ├── reporting.spec.ts         # Report generation
  └── ...
```

## Test Patterns

### Page Object Model

```typescript
// e2e/pages/transactions.page.ts
export class TransactionsPage {
  constructor(private page: Page) {}

  async navigateTo() {
    await this.page.goto('/cashflow/transactions');
  }

  async createTransaction(data: TransactionData) {
    await this.page.click('[data-testid="new-transaction-btn"]');
    await this.page.fill('[data-testid="amount-input"]', data.amount.toString());
    // ... fill other fields
    await this.page.click('[data-testid="save-btn"]');
  }

  async getTransactionCount() {
    return await this.page.locator('[data-testid="transaction-row"]').count();
  }
}
```

### Fixture Pattern

```typescript
// e2e/fixtures/auth.fixture.ts
import { test as baseTest } from '@playwright/test';

export const test = baseTest.extend({
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/auth/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-btn"]');
    await page.waitForNavigation();
    await use(page);
  },
});
```

## Critical User Flows to Test

| Flow | Steps | Purpose |
|------|-------|---------|
| **Login** | Navigate to login → enter credentials → verify dashboard loads | Verify auth works |
| **Create Transaction** | Login → Navigate to transactions → Create → Verify in list | Verify CRUD |
| **Categorize** | Create transaction → Edit → Select category → Verify persists | Verify categorization |
| **View Reports** | Login → Navigate to reports → Generate → Verify data | Verify reporting pipeline |
| **Dark Mode** | Login → Toggle theme → Verify colors change | Verify dark mode works |

## Running Tests

```bash
# Run all tests
pnpm exec playwright test

# Run specific test file
pnpm exec playwright test e2e/auth.spec.ts

# Run in debug mode (headed browser)
pnpm exec playwright test --headed --debug

# Generate and view HTML report
pnpm exec playwright test
pnpm exec playwright show-report
```

## CI/CD Integration

Tests run automatically in GitHub Actions on PR:

```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm exec playwright install --with-deps
      - run: pnpm run build
      - run: pnpm exec playwright test
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Validation Checklist

- [ ] Playwright config is present and working
- [ ] Test directory structure is organized (fixtures, pages, tests)
- [ ] Page Object Models exist for major pages
- [ ] Critical user flows have tests
- [ ] Tests are marked with appropriate categories (@slow, @auth, etc.)
- [ ] CI/CD pipeline runs tests on PR
- [ ] HTML reports are generated and accessible
- [ ] No hardcoded test data (use fixtures instead)
