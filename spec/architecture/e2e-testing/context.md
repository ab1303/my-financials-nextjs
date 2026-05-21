# E2E Testing — Context

## Problem Statement

End-to-end testing is critical for ensuring user workflows function correctly across the entire application stack. As the codebase grows, manual testing becomes unsustainable. Automated E2E tests provide confidence that core user flows (login, transaction entry, reporting) still work after changes.

## Goals

1. **Establish E2E test infrastructure** — Playwright setup, browser configurations, test organization
2. **Document test patterns** — How to write reliable, maintainable E2E tests
3. **Define test coverage** — Critical user flows that must be tested
4. **Create CI/CD integration** — E2E tests run automatically on PR and deployment

## Domain Dependencies

See `.../hld.md` for architecture domain scope.

This feature applies to ALL features and domains in the application.

## Scope

### In Scope
- Playwright configuration and setup
- Test file organization and naming conventions
- Test patterns (page objects, fixtures, assertions)
- Critical user flow definitions (login, create transaction, view reports)
- CI/CD integration (GitHub Actions workflow for E2E tests)
- Test data setup and teardown

### Out of Scope
- Unit tests (that's development-standards or individual feature responsibility)
- Performance testing / load testing
- Visual regression testing
- Mobile app testing (web-only)
