# Individual Contacts — Context

Individual contacts are people the user donates to or pays zakat to. Users need to record names, relationship types (e.g., "Mother", "Friend"), and addresses for compliance and tracking. Relationship types are user-defined, supporting diverse family/cultural structures.

## Domain Dependencies
- See [hld.md](../hld.md) for architecture, models, and rationale.

## IN Scope
- Add/edit/delete individual contacts
- User-defined relationship types
- Australian address fields
- tRPC + Prisma CRUD

## OUT of Scope
- Contact import (CSV/vCard)
- Sharing contacts with other users
- Address geocoding/validation

## Existing Patterns to Reuse
- React Hook Form + Zod for forms
- tRPC protectedProcedure for server actions
- Toast notifications via `sonner`

## Known Constraints / Gotchas
- RelationshipType is unique per user (name, userId)
- `userId` is always inferred from session, never passed from client
- Address fields are optional except `name`