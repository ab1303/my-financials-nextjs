# Site Audit — Context

## Problem Statement

The application has 18+ pages and complex user workflows. Manual testing before release is incomplete and error-prone. Automated site auditing (via Playwright) can detect regressions: broken pages, missing content, accessibility violations, performance issues.

This feature documents the audit process, findings, and remediation workflow.

## Goals

1. **Establish automated audit infrastructure** — Playwright-based site scanning
2. **Document audit findings** — Known issues, severity levels, remediation status
3. **Create remediation workflow** — How to fix issues found by audits
4. **Establish baseline metrics** — Critical issues that must be fixed before release

## Domain Dependencies

See `.../hld.md` for architecture domain scope.

This feature is cross-cutting and applies to **ALL pages and features** in the application.

## Scope

### In Scope
- Automated site audit via Playwright (page crawls, error detection)
- Accessibility scanning (WCAG compliance, semantic HTML)
- Broken link detection
- Performance metrics (page load time, Core Web Vitals)
- Critical error categorization (crashes, 500s, missing content)
- Issue triage and severity levels (Critical, High, Medium, Low)

### Out of Scope
- Visual regression testing
- Manual QA testing
- Load testing / stress testing
