# Bank Assets Feature - Migration Instructions

## Prerequisites

Before running the database migration, you need:

1. **PowerShell 6+** (PowerShell Core) installed
   - Download from: https://aka.ms/powershell
   - Or install via: `winget install Microsoft.PowerShell`

2. **No running dev server**
   - Stop any running `pnpm run dev` processes
   - Check for Node.js processes with Task Manager or `tasklist | findstr node`

## Running the Migration

### Option 1: Using the Migration Script (Recommended)

```powershell
# From the project root directory
.\scripts\migrate-bank-assets.ps1
```

The script will:

- Check for running Node.js processes
- Run the Prisma migration
- Generate the Prisma client
- Provide clear feedback at each step

### Option 2: Manual Migration

If you prefer to run the commands manually:

```bash
# 1. Stop any running dev server first!

# 2. Run the migration
pnpm prisma migrate dev --name add_bank_assets_models

# 3. Generate Prisma client
pnpm prisma generate
```

## What This Migration Does

This migration adds three new tables to support Bank Assets Cash Tracking:

1. **BankAccount**: Stores individual bank accounts (e.g., "Savings", "Term Deposit")
   - Links to Business (type=BANK)
   - User-scoped with unique constraint per bank

2. **BankAssetSnapshot**: Stores point-in-time cash position snapshots
   - Contains snapshot date and links to user
   - One snapshot can contain multiple account entries

3. **BankAssetEntry**: Stores individual account balances within a snapshot
   - Links to BankAccount and BankAssetSnapshot
   - Stores the balance amount using @db.Money (Decimal)

## Database Schema

```prisma
model BankAccount {
  id         String           @id @default(cuid())
  name       String
  bankId     String
  bank       Business         @relation(fields: [bankId], references: [id])
  userId     String
  user       User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  entries    BankAssetEntry[]
  createdAt  DateTime         @default(now())
  updatedAt  DateTime         @updatedAt

  @@unique([name, bankId, userId])
  @@index([userId, bankId])
}

model BankAssetSnapshot {
  id           String           @id @default(cuid())
  snapshotDate DateTime
  userId       String
  user         User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  entries      BankAssetEntry[]
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  @@index([userId, snapshotDate])
}

model BankAssetEntry {
  id         String            @id @default(cuid())
  balance    Decimal           @db.Money
  accountId  String
  account    BankAccount       @relation(fields: [accountId], references: [id])
  snapshotId String
  snapshot   BankAssetSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  createdAt  DateTime          @default(now())
  updatedAt  DateTime          @updatedAt

  @@unique([accountId, snapshotId])
  @@index([snapshotId])
}
```

## After Migration

1. Restart your development server: `pnpm run dev`
2. The new API endpoints will be available at `trpc.bankAsset.*`
3. You can now proceed with Phase 2: UI implementation

## Troubleshooting

### EPERM Errors

If you get EPERM (permission denied) errors:

- Stop all Node.js processes (dev server, etc.)
- Close VS Code or any editors that might lock files
- Retry the migration

### Migration Failed

If the migration fails:

1. Check your DATABASE_URL in `.env`
2. Ensure PostgreSQL is running
3. Check migration logs in `prisma/migrations/`

### Rollback

If you need to rollback:

```bash
pnpm prisma migrate reset
```

⚠️ **WARNING**: This will delete all data! Make backups first.

## Next Steps

After successful migration:

- [ ] Phase 2: Basic UI - Display
- [ ] Phase 3: Snapshot Creation
- [ ] Phase 4: Edit & Delete
- [ ] Phase 5: Polish & Testing
