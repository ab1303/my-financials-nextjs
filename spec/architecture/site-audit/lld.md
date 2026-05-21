# Site Audit — Low-Level Design

## Audit Process

### Phase 1: Automated Scanning

Run Playwright audit script against all 18 routes:

```bash
pnpm exec playwright test e2e/site-audit.spec.ts --headed
```

**Script Structure**:

```typescript
// e2e/site-audit.spec.ts
const routes = [
  '/',
  '/home',
  '/cashflow/income',
  '/cashflow/expense',
  '/cashflow/donations',
  '/settings/profile',
  // ... all 18 routes
];

for (const route of routes) {
  test(`audit ${route}`, async ({ page }) => {
    await page.goto(route);
    
    // Check for console errors
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    
    // Check HTTP errors
    page.on('response', (response) => {
      if (response.status() >= 400) {
        errors.push(`HTTP ${response.status()}: ${response.url()}`);
      }
    });
    
    // Check for missing elements
    const mainElement = await page.$('main');
    if (!mainElement) {
      errors.push('Missing <main> element (accessibility issue)');
    }
    
    // Collect audit findings
    const results = { route, errors, warnings: [] };
    fs.writeFileSync(`audit-results-${route.replace(/\//g, '-')}.json`, JSON.stringify(results));
  });
}
```

### Phase 2: Analysis & Categorization

**Severity Levels**:

| Level | Definition | Example |
|-------|-----------|---------|
| 🔴 Critical | Page is completely broken; no content renders | Prisma model undefined, app crashes |
| 🟠 High | Page loads but key features fail | Data table broken, API 500 |
| 🟡 Medium | Page works but UX is degraded | Missing title, poor accessibility |
| 🔵 Low | Minor issues, no functional impact | 404 on unused asset, font warning |

### Phase 3: Remediation

For each issue:

1. **Reproduce** — Manually verify the issue exists
2. **Root Cause** — Understand why it happens
3. **Fix** — Apply the code change
4. **Verify** — Re-run audit to confirm fix
5. **Document** — Add to issue tracker

**Example Issue & Fix**:

```
Issue: CRIT-01 · `/cashflow/income` — Prisma `aggregate` called on `undefined`

Root Cause:
  - Server Component imports a Prisma model that doesn't exist or is undefined
  - Likely a renamed model (e.g., `Income` → `IncomeEntry`)

Fix:
  1. Check src/server/services/income.service.ts
  2. Look for prisma.income or prisma.{modelName}
  3. Verify the model exists in prisma/schema.prisma
  4. If renamed, update the import/usage

Verification:
  - Navigate to /cashflow/income in browser
  - Verify page loads without errors
  - Check browser console for no JavaScript errors
```

## Audit Findings Template

**File**: `site-audit-results.md`

```markdown
# Site Audit — {Date}

**Audited Pages**: 18  
**Tool**: Playwright  
**Issues Found**: {count}

## Summary

| Severity | Count | Examples |
|----------|-------|----------|
| 🔴 Critical | X | CRIT-01, CRIT-02, ... |
| 🟠 High | Y | HIGH-01, HIGH-02, ... |
| 🟡 Medium | Z | MED-01, MED-02, ... |

## Critical Issues

### CRIT-01 · {Page} — {Issue}

**Error**: {error message}

**Root Cause**: {explanation}

**Status**: ⏳ Open / ✅ Fixed

**Files to Change**:
- src/server/services/{service}.ts
- src/app/{route}/page.tsx
- ...

---

## Remediation Status

| Issue | Status | Assigned To | ETA |
|-------|--------|-------------|-----|
| CRIT-01 | ✅ FIXED | @user | - |
| HIGH-01 | ⏳ OPEN | @user | 2025-06-20 |
```

## Running Audits Regularly

### Manual Audit

```bash
# Before release, run full site audit
pnpm exec playwright test e2e/site-audit.spec.ts
```

### Automated CI Audit

**GitHub Actions Workflow**:

```yaml
name: Site Audit
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: pnpm install
      - run: pnpm run build
      - run: pnpm run dev &
      - run: pnpm exec playwright test e2e/site-audit.spec.ts
      - uses: actions/upload-artifact@v3
        with:
          name: audit-results
          path: audit-results*.json
```

## Reporting

After each audit:

1. **Categorize issues** by severity
2. **Assign ownership** (which domain/service owns the fix?)
3. **Set deadlines** (Critical: same day; High: 3 days; Medium: 1 week)
4. **Track remediation** in issue tracker
5. **Verify fixes** with re-run of affected pages

## Validation Checklist

- [ ] Audit script covers all 18 production routes
- [ ] Console errors are captured and categorized
- [ ] HTTP 4xx/5xx responses trigger alerts
- [ ] Accessibility checks (main element, landmarks) are included
- [ ] Results are persisted in JSON for trending
- [ ] CI/CD integration is configured
- [ ] Critical issues are fixed before release
- [ ] Audit results are shared with team
