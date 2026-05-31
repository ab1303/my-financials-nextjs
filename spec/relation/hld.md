# Relation Domain High-Level Design (HLD)

The relation domain manages user contacts—both individuals and organisations—referenced in philanthropic transactions (zakat, donations). It provides a unified interface for users to manage people and charities they interact with, supporting custom relationship types and enforcing clear separation between user-managed and admin-managed entities.

## Architecture Decisions

1. **Dual-purpose Business Model**: The `Business` model supports both global (admin-managed) and user-specific (philanthropy) contacts. Rationale: avoids duplication and enables consistent referencing in transactions.
2. **User-Scoped Relationship Types**: `RelationshipType` is per-user, allowing custom labels (e.g., "Mother", "Friend"). Rationale: supports diverse family/cultural structures.
3. **Australian Address Format**: All contact addresses use AU format (street, suburb, state, postcode). Rationale: aligns with primary user base and simplifies validation.
4. **tRPC + Prisma for Data Access**: All CRUD operations use tRPC routers with Prisma ORM. Rationale: ensures type safety and secure, session-based access.

## Data Model Summary

- **Individual**: A person the user transacts with. Has name, optional first/last name, address, and relationship type.
- **RelationshipType**: User-defined label for individual relationships. Unique per user.
- **Business**: Organisation the user transacts with. Dual-purpose: global (BANK, BROKERAGE) or user (PHILANTHROPY).

## Features in this Domain

| Feature                | Route                          | Description                                      |
|-----------------------|-------------------------------|--------------------------------------------------|
| Individual Contacts   | /relation/individual           | Manage people the user donates/pays zakat to     |
| Business Contacts     | /relation/business             | Manage user-created charities/organisations      |
| Relationship Types    | (inline in /relation/individual) | User-defined relationship labels                |

## Out of Scope

| Area                        | Reason                                  |
|-----------------------------|-----------------------------------------|
| Bank/Brokerage management   | Managed in banking domain               |
| Contact import (CSV/vCard)  | Not supported                           |
| User-to-user sharing        | Not supported                           |
| Address geocoding/validation| Not implemented                         |
