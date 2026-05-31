# Business (Philanthropy) Contacts — Context

Business contacts are organisations (charities, philanthropic orgs) the user donates to. Only user-created businesses of type PHILANTHROPY are managed here. Banks and brokerages are global/admin-managed and excluded from this feature. Users need to record names and addresses for donation tracking and compliance.

## Domain Dependencies
- See [hld.md](../hld.md) for architecture, models, and rationale.

## IN Scope
- Add/edit/delete PHILANTHROPY business contacts
- Australian address fields
- tRPC + Prisma CRUD

## OUT of Scope
- Bank and brokerage management
- Global institution creation
- Contact import (CSV/vCard)
- Address geocoding/validation

## Existing Patterns to Reuse
- React Hook Form + Zod for forms
- tRPC protectedProcedure for server actions
- Toast notifications via `sonner`

## Known Constraints / Gotchas
- Only businesses with `type = PHILANTHROPY` and `userId` set are shown
- `userId` is always inferred from session, never passed from client
- Address fields are optional except `name`