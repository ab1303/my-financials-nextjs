# Entity Relations — Context

## Problem Statement

The application tracks multiple types of financial entities: individuals (family members, dependents), businesses (organizations), and their relationships (spouse, child, employer, charity). There is need for clear architectural guidance on how to model, query, and manage these entity relationships.

## Goals

1. **Define entity relationship model** — How individuals, businesses, and relationships are represented
2. **Document query patterns** — How to efficiently retrieve related entities
3. **Establish constraints** — What relationships are allowed, cardinalities, constraints
4. **Create UI patterns** — How to display and manage relationships in forms

## Domain Dependencies

See `.../hld.md` for architecture domain scope.

This feature is cross-cutting and supports the User-Profile domain (individual management, business management, relationships).

## Scope

### In Scope
- Individual entity schema (person, name, date of birth, tax ID, etc.)
- Business entity schema (organization, ABN, business type)
- Relationship model (spouse, child, dependent, employer, charity, etc.)
- Cardinality constraints (one-to-one, one-to-many, many-to-many)
- Query patterns (get all dependents, find employer, etc.)
- Data validation rules (can a person have 2 spouses? can a business have multiple owners?)

### Out of Scope
- Individual profile pages (that's user-profile domain)
- Business details management (that's user-profile domain)
- Reporting on relationships (that's cashflow domain)
