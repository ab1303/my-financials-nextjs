# _prisma_migrations

## Purpose
Prisma-managed system table that records migration execution history, checksums, timestamps, and operational metadata for schema changes applied to the database.

## Domain
System

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| Prisma-managed metadata columns | System-defined | Varies | Internal migration bookkeeping columns created and maintained by Prisma Migrate. |

## Relationships
### Belongs To
- None

### Has Many
- None

## Indexes & Constraints
- Managed internally by Prisma Migrate

## Notes
This table is not defined as an application model in the provided schema summary. Treat it as infrastructure metadata rather than business data.