# Banking Domain High-Level Design (HLD)

## Overview
This document defines the shared architecture, models, and patterns for all features in the Banking domain. It consolidates prior HLDs and establishes canonical interfaces for bank institutions, accounts, and integrations.

## Shared Models
- **BankInstitution**: Canonical model for all financial institutions (banks, credit unions, brokerages).
- **BankAccount**: Unified account model (checking, savings, brokerage, business).
- **InstitutionIntegration**: Abstraction for Plaid, MX, and direct integrations.

## Domain Patterns
- **Client Wrapper Pattern**: Used for interactive features requiring both server data and client state.
- **User-Specific Data Pattern**: For business/bank details, user context is injected server-side.
- **tRPC Routers**: All banking APIs use tRPC for typesafe contracts.
- **Prisma ORM**: All persistent models defined in `/prisma/schema.prisma`.

## Security & Compliance
- All sensitive data is encrypted at rest.
- No secrets are exposed to the client.
- All integrations must support OAuth or token-based auth.

## Dependencies
- See `/prisma/schema.prisma` for canonical models.
- See `.ai/instructions/database-safety.md` for migration safety.

---
This HLD is referenced by all features in `spec/banking/`.
