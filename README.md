# My Financials built on "Create T3 App"

This is an app bootstrapped according to the [init.tips](https://init.tips) stack, also known as the T3-Stack.

## What's next? How do I make an app with this?

We try to keep this project as simple as possible, so you can start with the most basic configuration and then move on to more advanced configuration.

If you are not familiar with the different technologies used in this project, please refer to the respective docs. If you still are in the wind, please join our [Discord](https://t3.gg/discord) and ask for help.

- [Next-Auth.js](https://next-auth.js.org)
- [Prisma](https://prisma.io)
- [TailwindCSS](https://tailwindcss.com)
- [tRPC](https://trpc.io)

We also [roll our own docs](https://beta.create.t3.gg) with some summary information and links to the respective documentation.

## Overall TechStack

- Next.js for the React-based frontend and routing (next)
- TypeScript for type safety (typescript)
- tRPC for typesafe APIs (@trpc/server, @trpc/client, @trpc/react-query)
- Prisma for ORM and database management (prisma, @prisma/client)
- NextAuth.js for authentication (next-auth)
- Tailwind CSS for styling (tailwindcss)
- React Query for data fetching and caching (@tanstack/react-query)
- Immer for immutable state management (immer)
- Sonner for notifications (sonner)
- React Select for select inputs (react-select)
- React Icons for iconography (react-icons)
- TanStack Table for interactive data tables (@tanstack/react-table)
- Zod for schema validation (zod)

## Features

### Income Management (NEW - December 2025)

Track and analyze your income with comprehensive CRUD operations and analytical reporting.

**Income Tracking (`/cashflow/income`):**

- Record income entries by date, amount, and source
- Support for multiple income sources: Employment, Stocks, Bonds, Rental, Business, Freelance, Other
- Fiscal year-based organization
- Inline editing with TanStack Table
- Real-time total income calculation
- User-scoped data with authentication

**Income Summary (`/reports/income-summary`):**

- Monthly income aggregations with totals
- Source breakdown analysis with percentages
- Expandable accordion view for detailed drill-down
- Summary statistics (total income, average monthly, months recorded)
- Fiscal year filtering

**Technical Implementation:**

- Two-tier database structure (Income → IncomeEntry)
- Server-side validation with Zod schemas
- User ownership verification at controller level
- Toast notifications for all user actions
- Context + useReducer state management
- Server Actions for CRUD operations

### Other Features

- **Zakat Management** - Calculate and track zakat payments
- **Donations Tracking** - Record charitable donations
- **Bank Interest Management** - Track interest earned
- **Business & Individual Relations** - Manage entities
- **Calendar Year Management** - Configure fiscal years

## Versions

`Node: 20.18.1 `

## Docker Compose

- Start Docker service
  `docker-compose up -d`

## Migration to NextJS 13

```
    pnpm up next react react-dom eslint-config-next --latest
    pnpm upgrade eslint-config-next@latest

    pnpm i -D @next/codemod@latest
    pnpm add -D @babel/preset-env@^7.1.6

    npx @next/codemod new-link ./src/pages/ --dry

    npx @next/codemod next-image-to-legacy-image ./src --print

    npx @next/codemod next-image-experimental ./src --print
```
