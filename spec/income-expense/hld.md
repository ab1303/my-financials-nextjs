# Income & Expense Domain Architecture (HLD)

## Overview
This document consolidates the architecture, shared models, and design patterns for all income and expense management features, including income management, expense tracking, interest cleansing, and income UX improvements.

## Shared Models

### IncomeRecord
- `id: string` — Unique identifier
- `userId: string` — Owner of the record
- `amount: number` — Amount received
- `source: string` — Income source (e.g., salary, business)
- `date: Date` — Date of income
- `category: string` — Income category
- `notes?: string` — Optional notes
- `createdAt: Date`
- `updatedAt: Date`

### ExpenseEntry
- `id: string`
- `userId: string`
- `amount: number`
- `category: string` — Expense category (e.g., food, rent)
- `date: Date`
- `notes?: string`
- `createdAt: Date`
- `updatedAt: Date`

### InterestCleansingRecord
- `id: string`
- `userId: string`
- `amount: number`
- `source: string` — Source of interest
- `date: Date`
- `cleansed: boolean` — Whether interest has been cleansed
- `cleansedDate?: Date`
- `notes?: string`
- `createdAt: Date`
- `updatedAt: Date`

## Shared Patterns
- All records are multi-tenant (scoped by userId).
- CRUD operations are performed via tRPC routers.
- Zod schemas enforce validation for all models.
- Prisma is the ORM for persistence.
- All features use Server Components for data fetching and mutations, with Client Wrapper pattern for interactivity.
- All monetary values are stored as integers (cents) to avoid floating-point errors.

## Domain Decisions
- Interest cleansing is a distinct process but shares the base record structure.
- UX improvements are implemented as enhancements to the base income/expense flows, not as separate models.
- All features reference this HLD for shared models and patterns.
