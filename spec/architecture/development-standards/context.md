# Development Standards — Context

## Problem Statement

As the codebase grows across multiple domains and features, developers need clear guidelines for code organization, naming conventions, file structure, and best practices. Without documented standards, inconsistencies accumulate: variable naming drift, module organization chaos, and knowledge silos.

## Goals

1. **Establish naming conventions** — Clear rules for database schema, variables, functions, and types
2. **Define code organization** — Module structure, file placement, folder hierarchy
3. **Document best practices** — Patterns that have proven effective in the codebase
4. **Create onboarding guides** — New developers can understand the codebase structure quickly

## Domain Dependencies

See `.../hld.md` for architecture domain scope.

This feature applies to ALL domains and features in the application.

## Scope

### In Scope
- File and folder naming conventions
- Function and variable naming conventions
- Module organization patterns (feature-based structure, co-location)
- TypeScript conventions (interfaces, types, generics)
- React component patterns and best practices
- Server/Client Component boundaries
- Database schema naming (models, fields, relations)
- Test file organization and naming

### Out of Scope
- Styling conventions (that's design-modernization)
- API route patterns (see individual domain specs)
- Deployment procedures (that's e2e-testing or site-audit)
