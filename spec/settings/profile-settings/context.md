# Profile Settings Context

Profile settings allow users to update their name, email, preferred currency, fiscal year type, timezone, and avatar. These preferences personalize the app experience and are stored on the User model. Avatar upload supports local and S3 storage.

## Domain Dependencies
- See `spec/settings/hld.md` for User model, enums, and storage providers

## IN Scope
- Update name, email, currency, fiscal year type, timezone
- Avatar upload (local/S3)
- tRPC for profile CRUD
- Client-side validation

## OUT of Scope
- Password reset/change
- Account deletion
- Multi-user/team settings
- Notification preferences

## Patterns to Reuse
- tRPC protectedProcedure for mutations
- React Hook Form + Zod for validation
- Client Component for interactivity
- Avatar upload pattern (local/S3)

## Constraints/Gotchas
- Email must be unique
- Avatar upload requires multipart handling
- Only allowed fields can be updated via tRPC