# Schema Naming — Context

## Problem Statement

The Prisma schema defines all database models, relationships, and constraints. As the schema grows (40+ models), naming inconsistencies accumulate: some models use singular nouns, others plural; some field names are terse, others verbose; some relations have unclear cardinality.

Clear naming conventions prevent confusion and make the schema self-documenting.

## Goals

1. **Establish model naming rules** — How to name Prisma models consistently
2. **Define field naming patterns** — Conventions for scalar fields, relations, timestamps
3. **Document constraint naming** — How to name indexes, unique constraints
4. **Codify relation naming** — How to name and orient relationships

## Domain Dependencies

See `.../hld.md` for architecture domain scope.

This feature is foundational and applies to the **Prisma schema** across ALL domains.

## Scope

### In Scope
- Model naming (singular vs. plural)
- Field naming (camelCase, timestamps, IDs)
- Relation naming (cardinality, naming conventions)
- Index and constraint naming
- Enum naming conventions
- Database column naming (@db.*)

### Out of Scope
- Application-level type naming (that's development-standards)
- API field naming (REST vs. tRPC)
- Messaging/event field naming
