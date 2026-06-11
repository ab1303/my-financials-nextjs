# My Financials - Comprehensive Financial Management Application

A full-featured financial management platform built on the [T3 Stack](https://init.tips), enabling users to track income, expenses, assets, transactions, and generate insightful financial reports.

## Tech Stack

- **Frontend**: Next.js 16+ (App Router) with React 19 and TypeScript
- **Backend API**: tRPC for typesafe API calls
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js v5 (beta)
- **Styling**: Tailwind CSS + Flowbite components
- **Data Tables**: TanStack Table with advanced filtering
- **State Management**: React Context + useReducer, React Query for data caching
- **Validation**: Zod schemas for runtime validation
- **AI Integration**: AI SDK (OpenAI support)
- **File Upload**: AWS S3 integration
- **Testing**: Playwright e2e, Vitest for unit/integration tests
- **Development**: pnpm workspaces, ESLint, Prettier, Husky

## Features

### Core Financial Tracking

- **Income Management** - Track multiple income sources (Employment, Stocks, Bonds, Rental, Business, Freelance)
  - Monthly aggregations and source breakdowns
  - Income Summary reports with analytics
  - Fiscal year organization

- **Expense Ledger** - Comprehensive expense tracking with categorization
  - Multiple expense categories
  - Receipt/invoice attachments
  - Fiscal year filtering

- **Transaction Management** - Bank and financial transaction tracking
  - CSV import from multiple banks (Commonwealth, NAB, etc.)
  - Automatic transaction classification
  - Transfer detection and exclusion rules
  - Merchant category mapping with AI enhancement

- **Asset Management** - Track financial assets and portfolio
  - Financial account management (bank, investment, crypto)
  - Portfolio snapshots for valuation tracking
  - Bank balance snapshots over time
  - Multi-account reconciliation

- **Banking Integration** - Connect to your bank accounts
  - Bank account setup and management
  - Balance tracking
  - Transaction history synchronization

### Advanced Features

- **Zakat Management** - Calculate zakat payments based on Islamic principles
- **Donation Tracking** - Record and track charitable contributions
- **Bank Interest Management** - Monitor and track interest earned
- **Relationship Management** - Manage business and individual relationships
- **Calendar Configuration** - Set custom fiscal years and reporting periods
- **AI-Assisted Features** - Leverage AI for transaction classification and merchant mapping
- **Multi-Account Reconciliation** - Reconcile transactions across multiple accounts

### Reporting & Analytics

- **Income Summary Reports** - Monthly breakdown with source analysis
- **Cashflow Audit Reports** - Track cash flow patterns and anomalies
- **Dashboard** - Real-time financial overview

### User Management

- **User Profiles** - Customizable user settings and preferences
- **Email Authentication** - Secure registration and login
- **Role-Based Access** - User and admin role support
- **Profile Management** - Upload avatars, set timezone, preferred currency

## Getting Started

### Prerequisites

- Node.js 20.18.1+
- pnpm (recommended) or npm/yarn
- Docker & Docker Compose (for local database)

### Installation

```bash
# Install dependencies
pnpm install

# Start PostgreSQL database in Docker
docker-compose up -d

# Set up environment variables
cp .env-example .env.local

# Run Prisma migrations
pnpm prisma migrate dev

# Seed sample data (optional)
pnpm prisma db seed

# Start development server
pnpm dev
```

The app will be available at [http://localhost:3000](http://localhost:3000)

## Database Management

### Backup

We provide a convenient script to backup and restore your PostgreSQL database.

**Create a Backup:**

```bash
# Backup to backup.sql in project root
./scripts/backup_postgres.sh backup

# Backup with timestamp
docker exec postgres-financials-db pg_dump -U postgres financials > backup-$(date +%Y%m%d-%H%M%S).sql

# Compressed backup (smaller file size)
docker exec postgres-financials-db pg_dump -U postgres -Fc financials > backup-$(date +%Y%m%d-%H%M%S).dump
```

**Restore from Backup:**

```bash
# Restore from backup.sql
./scripts/backup_postgres.sh restore

# Manual restore
cat backup.sql | docker exec -i postgres-financials-db psql -U postgres financials

# Restore from compressed backup
docker exec -i postgres-financials-db pg_restore -U postgres -d financials < backup.dump
```

**Restore to a Different Database:**

If you want to restore the backup to a different database name (useful for testing or staging):

```bash
# Using the backup script (restore to database named 'financials-bkup')
./scripts/backup_postgres.sh restore postgres-financials-db financials-bkup postgres

# Manual restore to a different database
cat backup.sql | docker exec -i postgres-financials-db psql -U postgres -d financials-bkup

# If the target database doesn't exist, create it first
docker exec postgres-financials-db createdb -U postgres financials-bkup
cat backup.sql | docker exec -i postgres-financials-db psql -U postgres -d financials-bkup
```

**Database Details:**

- Container: `postgres-financials-db`
- Database: `financials`
- User: `postgres`
- Port: `5432`

**Backup Best Practices:**

- Backup before major schema migrations
- Store backups in a separate location
- Test restore procedures regularly
- Use compressed format (`.dump`) for large databases

### Docker Compose

Start all services (PostgreSQL for dev + test):

```bash
docker-compose up -d
```

Stop services:

```bash
docker-compose down
```

View logs:

```bash
docker-compose logs -f postgres
```

## Development

### Available Scripts

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm start            # Start production server

# Code Quality
pnpm lint             # Run ESLint
pnpm lint:fix         # Fix linting issues
pnpm format           # Format code with Prettier
pnpm type-check       # Check TypeScript types

# Database
pnpm prisma migrate dev --name <name>   # Create migration
pnpm prisma studio                       # Open Prisma Studio UI
pnpm db:generate                         # Generate Prisma client

# Testing
pnpm test             # Run all tests
pnpm test:unit        # Run unit tests
pnpm test:integration # Run integration tests
pnpm test:e2e         # Run end-to-end tests
pnpm test:e2e:ui      # Run e2e tests with UI
pnpm test:e2e:headed  # Run e2e tests in headed browser
```

## Project Structure

```
src/
  app/                 # Next.js App Router
  components/          # Reusable React components
  server/
    api/              # tRPC API routers
    auth.ts           # NextAuth configuration
  lib/                # Utility functions and helpers
  types/              # TypeScript type definitions
  utils/              # General utilities
  styles/             # Global styles

prisma/
  schema.prisma       # Prisma schema definition
  migrations/         # Database migrations
  seed.ts            # Database seeding script

e2e/                  # Playwright end-to-end tests
  auth/               # Authentication tests
  cashflow/           # Cash flow feature tests
  settings/           # Settings feature tests
```

## Documentation

- [T3 Stack Documentation](https://create.t3.gg)
- [Next.js Docs](https://nextjs.org)
- [Prisma Docs](https://prisma.io)
- [tRPC Docs](https://trpc.io)
- [NextAuth.js Docs](https://next-auth.js.org)
