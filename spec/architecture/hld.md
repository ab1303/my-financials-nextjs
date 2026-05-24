# Architecture Domain — High-Level Design

## Overview

The Architecture domain encompasses app-wide architectural guidelines, standards, infrastructure, and design decisions that constrain how all other domains operate.

These are not domain-specific business features, but rather foundational patterns, naming conventions, testing infrastructure, and deployment standards that ensure consistency, maintainability, and quality across the entire application.

## Key Concerns

### 1. Design & UI Standards
- Visual design modernization (migration from Flowbite → shadcn/ui)
- Dark mode implementation and theming strategy
- Accessibility and responsive design principles
- Component library standardization

### 2. Development Standards
- Code organization and module structure
- Naming conventions (database schema, variables, functions)
- Best practices and coding guidelines
- Entity relationships and data modeling patterns

### 3. Infrastructure & Testing
- End-to-end testing strategy and framework (Playwright)
- CI/CD deployment and release procedures
- Monitoring and observability patterns
- Performance optimization and auditing

### 4. Deployment & Configuration
- Calendar attribution and multi-timezone support
- Currency display and localization strategies
- Feature rollout and gradual deployment patterns

## Architectural Principles

1. **Independence**: Each architecture feature addresses a distinct concern with minimal cross-cutting dependencies.
2. **Consistency**: Guidelines and standards ensure uniform patterns across all business domains.
3. **Scalability**: Infrastructure and testing patterns enable scaling without refactoring.
4. **Accessibility**: All UI and design standards prioritize WCAG compliance and inclusive design.
5. **Documentation**: Each architectural decision is documented with its rationale and constraints.

## Related Domains

- **Transactions, CSV-Import, Assets, Banking, Cashflow, AI-Features, User-Profile**: All business domains depend on these architectural standards for consistency.

## File Organization

This domain uses a 2-level structure (no sub-groups) because each architectural concern is independent:
- No shared patterns between calendar-attribution and design-modernization
- Each feature can be implemented/updated independently
- A developer working on design-modernization doesn't need context from e2e-testing

Individual features in this domain:
- calendar-attribution
- category-url-filtering
- design-modernization
- development-standards
- e2e-testing
- embedding-models
- entity-relations
- preferred-currency
- schema-naming
- site-audit
