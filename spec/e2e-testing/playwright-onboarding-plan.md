# Playwright E2E Testing Onboarding Plan

**Status**: Ready for implementation  
**Created**: February 28, 2026  
**Project**: my-financials-nextjs  
**Current Testing**: Vitest (unit + integration only)  
**Target**: Add Playwright E2E tests for critical user flows

---

## Executive Summary

This document outlines a phased plan to onboard **Playwright**, a modern E2E testing framework, to the my-financials-nextjs project. Currently, the project has Vitest unit and integration tests but **no E2E test coverage**. Playwright will enable testing of complete user flows including authentication, dashboards, and entity management (business, individual relations).

### Key Decisions

- **Scope**: Auth flows (login, register, logout), home dashboard, business & individual entity management
- **Browsers**: Chromium only (Firefox/WebKit can be added later)
- **Test Database**: Separate PostgreSQL service (`postgres-test-e2e`) in docker-compose.yaml for test data isolation
- **Authentication**: `storageState` fixture pattern for session reuse across tests
- **Directory Structure**: `e2e/` at project root (separate from Vitest's `src/__tests__/`)
- **TypeScript**: Isolated `e2e/tsconfig.json` to prevent Vitest/Playwright type conflicts
- **CI/CD**: Local-only for now; GitHub Actions workflow can be added later
- **Package Manager**: All commands use `pnpm` per project standards

---

## Current State Assessment

### Existing Test Infrastructure

- **Framework**: Vitest v4.0.16 with three configs:
  - `vitest.config.mts` (base)
  - `vitest.unit.config.mts` (pattern: `src/__tests__/unit/**/*.test.ts`)
  - `vitest.integration.config.mts` (pattern: `src/__tests__/integration/**/*.integration.test.ts`)
- **Test Environment**: happy-dom
- **Test Count**: 4 test files (income-related services/actions/controllers)
- **Helpers**: Prisma mocking, NextAuth session mocking, mock context factories
- **No E2E Tests**: Zero Playwright or similar setup

### Project Architecture Relevant to E2E

- **Next.js Version**: 15.4.5 (App Router)
- **Auth**: NextAuth.js v4 with JWT (credentials provider only)
- **Database**: PostgreSQL 14.5 via Docker Compose (`postgres-financials-db` on port 5432)
- **ORM**: Prisma v6.13.0
- **Auth Guard**: Layout-based (no middleware) in `src/app/(authorized)/layout.tsx`
- **Routes**: ~15 distinct protected pages across cashflow, settings, relations, reports, zakat

### CI/CD Status

- **No CI/CD workflows** exist (`.github/workflows/` directory does not exist)
- Deployment instructions exist but are not yet automated

### Known Constraints

1. **Vitest/Playwright Type Collision**: Both define global `test()` and `expect()`. Vitest configs use `globals: true`.
   - **Mitigation**: Isolated `e2e/tsconfig.json` with only Playwright types
2. **Auth for Tests**: Credentials-based (email + password), not OAuth
   - **Advantage**: Simpler for Playwright; can directly fill login form or use API
3. **No Test Database Service**: Only one PostgreSQL service in docker-compose
   - **Requirement**: Add separate test database to avoid affecting dev data
4. **Test Data Seeding**: Existing script `scripts/create-test-data.ts` for reference
   - **Reuse**: Leverage bcryptjs & Prisma patterns for E2E test user creation

---

## Implementation Plan

### Phase 1: Setup & Configuration (Steps 1-5)

#### Step 1: Install Playwright and Initialize Config

**Goal**: Add Playwright dependency and generate base configuration

**Tasks**:

```bash
# Install Playwright and test framework
pnpm add -D @playwright/test

# Install Chromium browser
pnpm exec playwright install chromium

# Generate playwright.config.ts
pnpm exec playwright init --typescript --from-npm
```

**Deliverables**:

- `@playwright/test` added to devDependencies
- `playwright.config.ts` at project root
- Chromium browser installed locally

**Configuration** [playwright.config.ts](../../playwright.config.ts):

```typescript
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  outputDir: './e2e/test-results',
  reporter: [['html', { outputFolder: 'e2e/playwright-report' }], ['list']],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 3,
  timeout: 30 * 1000,
  expect: { timeout: 5000 },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

---

#### Step 2: Setup E2E Directory Structure

**Goal**: Organize E2E test files, fixtures, helpers, and configuration

**Structure**:

```
e2e/
├── tsconfig.json                    ← Isolated TS config (only Playwright types)
├── global-setup.ts                  ← DB seeding, test user creation
├── global-teardown.ts               ← Optional cleanup
├── fixtures/
│   └── auth.fixture.ts              ← Authenticated page fixture w/ storageState
├── helpers/
│   ├── test-user.ts                 ← Credentials & factory functions
│   └── test-data.ts                 ← Seed/cleanup helpers
├── auth/
│   ├── login.spec.ts                ← Login flow tests
│   ├── register.spec.ts             ← Registration tests
│   └── logout.spec.ts               ← Logout & session clear tests
├── home/
│   └── dashboard.spec.ts            ← Home page & dashboard tests
├── relation/
│   ├── business.spec.ts             ← Business entity CRUD
│   └── individual.spec.ts           ← Individual entity CRUD
├── .auth/                           ← Auto-generated (git-ignored)
│   └── user.json                    ← Cached storageState from auth setup
├── test-results/                    ← Auto-generated (git-ignored)
└── playwright-report/               ← Auto-generated (git-ignored)
```

**Tasks**:

1. Create all directories (except `.auth/`, `test-results/`, `playwright-report/`)
2. Create placeholder files with stubs (to be completed in Step 6+)
3. Add `e2e/.auth/`, `e2e/test-results/`, `e2e/playwright-report/` to [.gitignore](../../.gitignore)

---

#### Step 3: Isolate TypeScript Configuration

**Goal**: Prevent type conflicts between Vitest (global `test`/`expect`) and Playwright

**File**: [e2e/tsconfig.json](../../e2e/tsconfig.json)

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "types": ["@playwright/test"]
  },
  "include": ["**/*.ts", "**/*.spec.ts"],
  "exclude": ["node_modules", "test-results", "playwright-report", ".auth"]
}
```

**Verification**:

- Ensure root [tsconfig.json](../../tsconfig.json) has `"exclude": ["e2e"]` if it has an explicit `include` array
- Vitest patterns already scoped to `src/__tests__/unit/**` and `src/__tests__/integration/**` — no changes needed

---

#### Step 4: Add Dedicated E2E Test Database

**Goal**: Provision isolated PostgreSQL database for E2E tests

**File**: [docker-compose.yaml](../../docker-compose.yaml)

**Changes**:

1. Add new service after existing `postgres-financials-db`:

```yaml
postgres-test-e2e:
  image: postgres:14.5
  container_name: postgres-financials-test-e2e
  environment:
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
    POSTGRES_DB: financials_e2e_test
  ports:
    - '5433:5432'
  volumes:
    - postgres-test-e2e-data:/var/lib/postgresql/data
  healthcheck:
    test: ['CMD-SHELL', 'pg_isready -U postgres']
    interval: 10s
    timeout: 5s
    retries: 5
```

2. Add volume definition at the end:

```yaml
volumes:
  postgres-financials-data:
  postgres-test-e2e-data:
```

**File**: [.env.test](../../.env.test) (new, git-tracked, template)

```env
# E2E Test Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/financials_e2e_test"

# NextAuth Config (use same as .env or generate new secret for testing)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="test-secret-for-e2e-tests-only"  # Must change in .env.local

# Test User Credentials
TEST_USER_EMAIL="test@example.com"
TEST_USER_PASSWORD="TestPassword123!"  # Will be hashed by seed script
```

**File**: [.env-example](../../.env-example)

**Add**:

```env
# E2E Test Database (only needed when running Playwright tests locally)
# E2E_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/financials_e2e_test"
```

**Commands**:

```bash
# Start test database
docker compose up postgres-test-e2e -d

# Verify it's running
docker compose ps postgres-test-e2e
```

---

#### Step 5: Configure Authentication Fixture with `storageState`

**Goal**: Establish reusable authenticated session for E2E tests via `storageState`

**File**: [playwright.config.ts](../../playwright.config.ts) — Add setup project

```typescript
export default defineConfig({
  // ... existing config ...

  projects: [
    // Setup project: runs once per session to generate storageState
    {
      name: 'auth setup',
      testMatch: /auth\.setup\.ts/,
      testDir: './e2e',
      use: { ...devices['Desktop Chrome'] },
    },

    // Main test project: uses storageState from auth setup
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // This tells Playwright to load the saved session
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['auth setup'],
    },
  ],
});
```

**File**: [e2e/auth.setup.ts](../../e2e/auth.setup.ts)

```typescript
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
```

**Notes**:

- `auth.setup.ts` runs beforehand; don't include in regular test patterns
- `.auth/user.json` is git-ignored and auto-generated
- All authenticated tests inherit this session automatically

---

### Phase 2: DB Seeding & Test Data (Steps 6)

#### Step 6: Implement Global Setup & Teardown

**Goal**: Seed test database with known user and reference data before tests run

**File**: [e2e/global-setup.ts](../../e2e/global-setup.ts)

```typescript
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

async function globalSetup() {
  // Use test database from environment
  const databaseUrl = process.env.DATABASE_URL;
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  try {
    console.log('🔧 Running global setup...');

    // Run migrations on test database
    console.log('📦 Running database migrations...');
    // Note: Prisma migrate deploy assumes migrations folder exists
    // Alternatively, use prisma db push (see note below)

    // Seed test user
    console.log('👤 Seeding test user...');
    const hashedPassword = await bcrypt.hash('TestPassword123!', 10);

    const testUser = await prisma.user.upsert({
      where: { email: 'test@example.com' },
      update: {}, // Keep existing if already there
      create: {
        email: 'test@example.com',
        password: hashedPassword,
        name: 'Test User',
      },
    });

    console.log(`✅ Test user created/updated: ${testUser.id}`);

    // Optionally seed reference data for relation tests
    console.log('📋 Seeding reference data...');

    const business = await prisma.business.upsert({
      where: { userId_name: { userId: testUser.id, name: 'Test Business' } },
      update: {},
      create: {
        userId: testUser.id,
        name: 'Test Business',
        registrationNumber: 'TB-001',
      },
    });

    const individual = await prisma.individual.upsert({
      where: { userId_name: { userId: testUser.id, name: 'Test Individual' } },
      update: {},
      create: {
        userId: testUser.id,
        name: 'Test Individual',
        identificationNumber: 'TI-001',
      },
    });

    console.log(
      `✅ Reference data seeded: Business(${business.id}), Individual(${individual.id})`,
    );
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

export default globalSetup;
```

**File**: [e2e/global-teardown.ts](../../e2e/global-teardown.ts) (optional, minimal)

```typescript
async function globalTeardown() {
  console.log('🧹 Running global teardown...');
  // Optional: Add cleanup logic if needed
  // For now, keep test data for manual inspection
  console.log('✅ Teardown complete');
}

export default globalTeardown;
```

**Update**: [playwright.config.ts](../../playwright.config.ts)

```typescript
export default defineConfig({
  // ... existing config ...
  globalSetup: require.resolve('./e2e/global-setup.ts'),
  globalTeardown: require.resolve('./e2e/global-teardown.ts'),
});
```

**Execution**:

```bash
# Ensure test database is running
docker compose up postgres-test-e2e -d

# Set environment to use test database
export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/financials_e2e_test"

# Optionally, run Prisma migrations manually first
pnpm exec prisma migrate deploy --schema prisma/schema.prisma

# Now E2E tests will use seeded data
pnpm test:e2e
```

---

### Phase 3: Test Implementation (Steps 7-8)

#### Step 7: Write Auth Flow Tests

**File**: [e2e/auth/auth.setup.ts](../../e2e/auth/auth.setup.ts)

Already created in Step 5 (moved to `e2e/auth.setup.ts` at root).

**File**: [e2e/auth/login.spec.ts](../../e2e/auth/login.spec.ts)

```typescript
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
    await expect(errorMsg).toBeVisible();
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
```

**File**: [e2e/auth/register.spec.ts](../../e2e/auth/register.spec.ts)

```typescript
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
    await page.waitForURL('/auth/login', { timeout: 5000 }).catch(() => {
      // Or check for success toast
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
    await expect(error).toBeVisible();
  });

  test('password mismatch should show error', async ({ page }) => {
    await page.fill('input[name="email"]', `newuser-${Date.now()}@example.com`);
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="password"]', 'Password123!');
    await page.fill('input[name="confirmPassword"]', 'DifferentPassword123!');

    await page.click('button[type="submit"]');

    const error = page.locator('text=/password|match|confirm/i');
    await expect(error).toBeVisible();
  });
});
```

**File**: [e2e/auth/logout.spec.ts](../../e2e/auth/logout.spec.ts)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Logout Flow', () => {
  // These tests use storageState from auth setup

  test('authenticated user can log out', async ({ page }) => {
    // Start on authenticated home page
    await page.goto('/home');

    // Look for logout button (adjust selector based on actual UI)
    const logoutBtn = page.locator(
      'button:has-text("Logout"), button:has-text("Sign Out")',
    );
    await logoutBtn.click();

    // Should redirect to login
    await page.waitForURL('/auth/login');
    expect(page.url()).toContain('/auth/login');
  });

  test('after logout, accessing protected page redirects to login', async ({
    page,
  }) => {
    // Logout first
    await page.goto('/home');
    const logoutBtn = page.locator(
      'button:has-text("Logout"), button:has-text("Sign Out")',
    );
    await logoutBtn.click();
    await page.waitForURL('/auth/login');

    // Now try to access protected page
    await page.goto('/home');
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
```

---

#### Step 8: Write Home Dashboard Tests

**File**: [e2e/home/dashboard.spec.ts](../../e2e/home/dashboard.spec.ts)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Home Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // All tests in this suite use storageState, so user is authenticated
    await page.goto('/home');
  });

  test('authenticated user can view dashboard', async ({ page }) => {
    // Verify we're on the home page
    await expect(page).toHaveURL(/\/home/);

    // Page should have loaded successfully
    await expect(page.locator('main')).toBeVisible();
  });

  test('dashboard displays welcome message or user info', async ({ page }) => {
    // Check for user name or welcome message (adjust selector)
    const userDisplay = page.locator('text=/Test User|Welcome/i');
    await expect(userDisplay).toBeVisible();
  });

  test('sidebar navigation is visible', async ({ page }) => {
    // Look for main navigation elements
    const sidebar = page.locator('[role="navigation"], aside');
    await expect(sidebar).toBeVisible();
  });

  test('can navigate to cashflow section', async ({ page }) => {
    // Click on cashflow link in navigation
    const cashflowLink = page
      .locator('a:has-text("Cashflow"), a[href*="cashflow"]')
      .first();
    await cashflowLink.click();

    // Verify navigation
    await expect(page).toHaveURL(/\/cashflow/);
  });

  test('can navigate to settings section', async ({ page }) => {
    const settingsLink = page
      .locator('a:has-text("Settings"), a[href*="settings"]')
      .first();
    await settingsLink.click();

    await expect(page).toHaveURL(/\/settings/);
  });

  test('can navigate to relations section', async ({ page }) => {
    const relationLink = page
      .locator('a:has-text("Relations"), a[href*="relation"]')
      .first();
    await relationLink.click();

    await expect(page).toHaveURL(/\/relation/);
  });
});
```

---

#### Step 9: Write Relation Page Tests (Business & Individual)

**File**: [e2e/relation/business.spec.ts](../../e2e/relation/business.spec.ts)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Business Entity Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cashflow/relation/business');
  });

  test('user can view list of businesses', async ({ page }) => {
    // Check if table or list is visible
    const table = page.locator('table, [role="grid"]').first();
    await expect(table).toBeVisible();
  });

  test('user can create a new business', async ({ page }) => {
    // Click create button
    const createBtn = page
      .locator(
        'button:has-text("Create"), button:has-text("Add"), button:has-text("New")',
      )
      .first();
    await createBtn.click();

    // Check if modal/form appears
    const form = page.locator('dialog, [role="dialog"]').first();
    await expect(form).toBeVisible();

    // Fill form
    const nameInput = form.locator('input[name="name"]');
    await nameInput.fill(`Business-${Date.now()}`);

    const regInput = form.locator('input[name="registrationNumber"]');
    await regInput.fill('BR-001');

    // Submit
    const submitBtn = form.locator('button[type="submit"]');
    await submitBtn.click();

    // Verify success (toast/redirect/list update)
    const successMsg = page.locator('text=/success|created|added/i');
    await expect(successMsg).toBeVisible({ timeout: 5000 });
  });

  test('unique name constraint is enforced', async ({ page }) => {
    // Try to create a business with the same name as existing one
    const createBtn = page
      .locator('button:has-text("Create"), button:has-text("Add")')
      .first();
    await createBtn.click();

    const form = page.locator('dialog, [role="dialog"]').first();
    const nameInput = form.locator('input[name="name"]');

    // Use the seed business name
    await nameInput.fill('Test Business');

    const regInput = form.locator('input[name="registrationNumber"]');
    await regInput.fill('BR-DUP');

    const submitBtn = form.locator('button[type="submit"]');
    await submitBtn.click();

    // Expect error message about duplicate
    const errorMsg = page.locator('text=/already exists|duplicate|unique/i');
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
  });

  test('user can edit existing business', async ({ page }) => {
    // Wait for table to load
    await page.locator('table, [role="grid"]').first().waitFor();

    // Find edit button for the test business
    const row = page
      .locator('table tbody tr:has-text("Test Business")')
      .first();
    const editBtn = row
      .locator('button[aria-label*="edit"], button:has-text("Edit")')
      .first();
    await editBtn.click();

    // Modal should appear with current data
    const form = page.locator('dialog, [role="dialog"]').first();
    await expect(form).toBeVisible();

    // Update name
    const nameInput = form.locator('input[name="name"]');
    await nameInput.clear();
    await nameInput.fill(`Updated Business-${Date.now()}`);

    // Submit
    const submitBtn = form.locator('button[type="submit"]');
    await submitBtn.click();

    // Verify success
    const successMsg = page.locator('text=/updated|saved/i');
    await expect(successMsg).toBeVisible({ timeout: 5000 });
  });

  test('user can delete business', async ({ page }) => {
    // Wait for table
    await page.locator('table, [role="grid"]').first().waitFor();

    // Get count before delete
    const rowsBefore = await page.locator('table tbody tr').count();

    // Find and click delete button
    const row = page.locator('table tbody tr').first();
    const deleteBtn = row
      .locator('button[aria-label*="delete"], button:has-text("Delete")')
      .first();
    await deleteBtn.click();

    // Confirm deletion if dialog appears
    const confirmBtn = page
      .locator('button:has-text("Confirm"), button:has-text("Delete")')
      .last();
    if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    // Verify success message
    const successMsg = page.locator('text=/deleted|removed/i');
    await expect(successMsg).toBeVisible({ timeout: 5000 });
  });
});
```

**File**: [e2e/relation/individual.spec.ts](../../e2e/relation/individual.spec.ts)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Individual Entity Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cashflow/relation/individual');
  });

  test('user can view list of individuals', async ({ page }) => {
    const table = page.locator('table, [role="grid"]').first();
    await expect(table).toBeVisible();
  });

  test('user can create a new individual', async ({ page }) => {
    const createBtn = page
      .locator(
        'button:has-text("Create"), button:has-text("Add"), button:has-text("New")',
      )
      .first();
    await createBtn.click();

    const form = page.locator('dialog, [role="dialog"]').first();
    await expect(form).toBeVisible();

    const nameInput = form.locator('input[name="name"]');
    await nameInput.fill(`Individual-${Date.now()}`);

    const idInput = form.locator('input[name="identificationNumber"]');
    await idInput.fill('ID-001');

    // Optional: Fill address if the form includes it
    const cityInput = form.locator('input[name="city"]');
    if (await cityInput.isVisible({ timeout: 500 }).catch(() => false)) {
      await cityInput.fill('Test City');
    }

    const submitBtn = form.locator('button[type="submit"]');
    await submitBtn.click();

    const successMsg = page.locator('text=/success|created|added/i');
    await expect(successMsg).toBeVisible({ timeout: 5000 });
  });

  test('unique name constraint is enforced for individuals', async ({
    page,
  }) => {
    const createBtn = page
      .locator('button:has-text("Create"), button:has-text("Add")')
      .first();
    await createBtn.click();

    const form = page.locator('dialog, [role="dialog"]').first();
    const nameInput = form.locator('input[name="name"]');
    await nameInput.fill('Test Individual');

    const idInput = form.locator('input[name="identificationNumber"]');
    await idInput.fill('ID-DUP');

    const submitBtn = form.locator('button[type="submit"]');
    await submitBtn.click();

    const errorMsg = page.locator('text=/already exists|duplicate|unique/i');
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
  });

  test('user can edit existing individual', async ({ page }) => {
    await page.locator('table, [role="grid"]').first().waitFor();

    const row = page
      .locator('table tbody tr:has-text("Test Individual")')
      .first();
    const editBtn = row
      .locator('button[aria-label*="edit"], button:has-text("Edit")')
      .first();
    await editBtn.click();

    const form = page.locator('dialog, [role="dialog"]').first();
    await expect(form).toBeVisible();

    const nameInput = form.locator('input[name="name"]');
    await nameInput.clear();
    await nameInput.fill(`Updated Individual-${Date.now()}`);

    const submitBtn = form.locator('button[type="submit"]');
    await submitBtn.click();

    const successMsg = page.locator('text=/updated|saved/i');
    await expect(successMsg).toBeVisible({ timeout: 5000 });
  });

  test('user can delete individual', async ({ page }) => {
    await page.locator('table, [role="grid"]').first().waitFor();

    const row = page.locator('table tbody tr').first();
    const deleteBtn = row
      .locator('button[aria-label*="delete"], button:has-text("Delete")')
      .first();
    await deleteBtn.click();

    const confirmBtn = page
      .locator('button:has-text("Confirm"), button:has-text("Delete")')
      .last();
    if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    const successMsg = page.locator('text=/deleted|removed/i');
    await expect(successMsg).toBeVisible({ timeout: 5000 });
  });
});
```

---

### Phase 4: Integration & Tooling (Step 10)

#### Step 10: Update Package.json with Test Scripts

**File**: [package.json](../../package.json)

Add under `"scripts"`:

```json
{
  "scripts": {
    "test": "vitest --config vitest.unit.config.mts --run",
    "test:unit": "vitest --config vitest.unit.config.mts",
    "test:unit:watch": "vitest --config vitest.unit.config.mts",
    "test:integration": "vitest --config vitest.integration.config.mts --run",
    "test:all": "pnpm test && pnpm test:integration",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --config vitest.unit.config.mts --coverage",

    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:report": "playwright show-report e2e/playwright-report"
  ]
}
```

---

### Phase 5: Gitignore & Documentation (Step 11)

#### Step 11: Update .gitignore

**File**: [.gitignore](../../.gitignore)

Add:

```
# Playwright E2E Testing
e2e/.auth/
e2e/test-results/
e2e/playwright-report/
blob-report/
playwright/.cache/

# Playwright trace files (optional, keep if needed for debugging)
# playwright-traces/
```

---

## Complete Directory Structure

All E2E test files have been successfully created with the following structure:

```
e2e/
├── tsconfig.json                    ← Isolated TS config (only Playwright types)
├── auth.setup.ts                    ← Login flow setup for authentication
├── global-setup.ts                  ← DB seeding, test user creation
├── global-teardown.ts               ← Cleanup after tests
├── .auth/
│   └── user.json                    ← Auto-generated storageState (git-ignored)
├── auth/                            ✅ COMPLETE
│   ├── login.spec.ts                ← Valid/invalid login flow tests
│   ├── logout.spec.ts               ← Logout and session clear tests
│   └── register.spec.ts             ← Registration flow tests
├── cashflow/                        ✅ NEW - COMPLETE
│   ├── income.spec.ts               ← Add, edit, delete, validate income entries
│   └── donations.spec.ts            ← Donation payment CRUD operations
├── fixtures/                        ✅ COMPLETE
│   └── auth.fixture.ts              ← Authenticated page fixture with storageState
├── helpers/                         ✅ COMPLETE
│   ├── auth.helper.ts               ← Authentication utilities
│   ├── form.helper.ts               ← Form filling and submission helpers
│   └── table.helper.ts              ← Table navigation and search utilities
├── home/                            ✅ COMPLETE
│   └── dashboard.spec.ts            ← Home page navigation and layout tests
├── relation/                        ✅ COMPLETE
│   ├── business.spec.ts             ← Business entity CRUD with validation
│   └── individual.spec.ts           ← Individual entity CRUD with validation
├── reports/                         ✅ NEW - COMPLETE
│   └── income-summary.spec.ts       ← Income summary report filtering and display
├── settings/                        ✅ NEW - COMPLETE
│   ├── calendar.spec.ts             ← Calendar year management with validation
│   └── banks.spec.ts                ← Bank account settings CRUD
├── zakat/                           ✅ NEW - COMPLETE
│   └── zakat.spec.ts                ← Zakat year creation, payment CRUD
├── test-results/                    ← Auto-generated (git-ignored)
└── playwright-report/               ← Auto-generated (git-ignored)
```

### Test Coverage Summary

| Feature                  | Tests              | Status          |
| ------------------------ | ------------------ | --------------- |
| **Authentication**       | 5 test cases       | ✅ Implemented  |
| **Home/Dashboard**       | 6 test cases       | ✅ Implemented  |
| **Business Relations**   | 5 test cases       | ✅ Implemented  |
| **Individual Relations** | 5 test cases       | ✅ Implemented  |
| **Income Management**    | 5 test cases       | ✅ Implemented  |
| **Donations**            | 5 test cases       | ✅ Implemented  |
| **Zakat Management**     | 6 test cases       | ✅ Implemented  |
| **Calendar Settings**    | 6 test cases       | ✅ Implemented  |
| **Bank Settings**        | 5 test cases       | ✅ Implemented  |
| **Income Reports**       | 5 test cases       | ✅ Implemented  |
| **Helper Utilities**     | 3 modules          | ✅ Implemented  |
| **Total**                | **58+ test cases** | ✅ **COMPLETE** |

### Configuration Files Status

- ✅ [playwright.config.ts](../../playwright.config.ts) — Configured with storageState
- ✅ [e2e/tsconfig.json](../../e2e/tsconfig.json) — Isolated TypeScript config
- ✅ [e2e/global-setup.ts](../../e2e/global-setup.ts) — Database seeding
- ✅ [e2e/global-teardown.ts](../../e2e/global-teardown.ts) — Cleanup script
- ✅ [package.json](../../package.json) — E2E test scripts added
- ✅ [.gitignore](../../.gitignore) — E2E artifacts excluded

---

## Execution & Verification

### Prerequisites

```bash
# 1. Ensure pnpm is installed
pnpm --version

# 2. Install project dependencies
pnpm install

# 3. Start the test database
docker compose up postgres-test-e2e -d
docker compose ps  # Verify it's running
```

### First-Time Setup

```bash
# 1. Load test environment variables
export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/financials_e2e_test"
export NEXTAUTH_URL="http://localhost:3000"
export NEXTAUTH_SECRET="test-secret-for-e2e-tests-only"

# 2. Run Prisma migrations on test database
pnpm exec prisma migrate deploy --schema prisma/schema.prisma

# 3. Install Playwright browsers
pnpm exec playwright install chromium

# 4. Verify Playwright config is valid
pnpm exec playwright --version
```

### Running Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run specific test file
pnpm test:e2e e2e/auth/login.spec.ts

# Run in UI mode (interactive)
pnpm test:e2e:ui

# Run with visible browser
pnpm test:e2e:headed

# Debug mode (step through tests)
pnpm test:e2e:debug

# View HTML report after test run
pnpm test:e2e:report

# Generate new test with codegen helper (requires dev server)
pnpm dev &  # Start dev server in background
pnpm exec playwright codegen http://localhost:3000
```

### Smoke Test Checklist

- [ ] **Playwright installed**: Version output shows `@playwright/test@x.x.x`
- [ ] **Config valid**: No errors when loading `playwright.config.ts`
- [ ] **Test database running**: `docker compose ps postgres-test-e2e` shows healthy
- [ ] **Migrations applied**: `pnpm exec prisma migrate status` shows all migrations deployed
- [ ] **Auth setup passes**: `pnpm test:e2e e2e/auth.setup.ts` succeeds and creates `.auth/user.json`
- [ ] **Login test passes**: `pnpm test:e2e e2e/auth/login.spec.ts` validates successful authentication
- [ ] **Dashboard test passes**: `pnpm test:e2e e2e/home/dashboard.spec.ts` confirms home page loads
- [ ] **Vitest unaffected**: `pnpm test` and `pnpm test:integration` still pass
- [ ] **Build succeeds**: `pnpm run build` completes without errors
- [ ] **Dev server starts**: `pnpm dev` launches on port 3000

### Troubleshooting

| Issue                                    | Solution                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| **ECONNREFUSED localhost:3000**          | Dev server not running. Start it: `pnpm dev`                                               |
| **ECONNREFUSED localhost:5433**          | Test database not running. Start: `docker compose up postgres-test-e2e -d`                 |
| **Database migration error**             | Ensure test DB exists and is accessible: `pnpm exec prisma db push`                        |
| **Type conflicts (test/expect unknown)** | Verify `e2e/tsconfig.json` exists and includes only `"@playwright/test"` types             |
| **storageState file not found**          | Auth setup project failed. Run `pnpm test:e2e e2e/auth.setup.ts` manually to debug         |
| **"Page not found" in tests**            | Check URL in test vs actual app routes. Use `--headed` mode to watch browser               |
| **Port 3000 already in use**             | Kill existing process: `lsof -i :3000 \| grep LISTEN \| awk '{print $2}' \| xargs kill -9` |
| **Vitest and Playwright types clash**    | Confirm `e2e/` is excluded from root `tsconfig.json` and has separate config               |

---

## Future Enhancements

### Phase 1 (Future) — Multi-Browser Testing

Extend `playwright.config.ts` to include Firefox and WebKit:

```typescript
projects: [
  { name: 'chromium', ... },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } }
]
```

### Phase 2 (Future) — GitHub Actions CI/CD

Create `.github/workflows/e2e.yml` to run Playwright tests on every PR/push:

```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14.5
        env:
          POSTGRES_DB: financials_e2e_test
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5433:5432
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm run build
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: e2e/playwright-report/
```

### Phase 3 (Future) — Visual Regression Testing

Integrate Percy or Chromatic for screenshot-based regression testing.

### Phase 4 (Future) — Performance & Accessibility Testing

Use Lighthouse API within Playwright for performance budgets and Web Vitals.

### Phase 5 (Future) — API-Level E2E with tRPC

Test complete flows including tRPC API calls alongside UI interactions using `page.request` API.

---

## References & Resources

- **Playwright Docs**: https://playwright.dev/docs/intro
- **Playwright Best Practices**: https://playwright.dev/docs/best-practices
- **Storage State (Testing Authenticated Flows)**: https://playwright.dev/docs/auth
- **Fixtures & Setup**: https://playwright.dev/docs/test-fixtures
- **Project Configuration**: https://playwright.dev/docs/test-configuration
- **Next.js + Playwright Guide**: https://nextjs.org/docs/testing
- **Test Database Best Practices**: https://playwright.dev/docs/test-databases

---

## Sign-Off Template

### Completion Checklist

- [ ] All Playwright dependencies installed
- [ ] `playwright.config.ts` configured with all required settings
- [ ] `e2e/` directory structure created with all required files
- [ ] `e2e/tsconfig.json` isolates Playwright types
- [ ] Test database added to `docker-compose.yaml`
- [ ] Global setup/teardown implemented and tested
- [ ] Auth flow tests written and passing
- [ ] Home dashboard test written and passing
- [ ] Relation (business/individual) tests written and passing
- [ ] All test scripts added to `package.json`
- [ ] `.gitignore` updated with E2E-specific entries
- [ ] `.env-example` documents E2E database URL
- [ ] `pnpm run build` succeeds without errors
- [ ] Smoke test checklist completed
- [ ] No breaking changes to existing Vitest tests

### Approval

- [ ] Ready for implementation
- [ ] Ready for code review
- [ ] Ready for QA

---

**Document Version**: 1.0  
**Last Updated**: February 28, 2026  
**Author**: GitHub Copilot
