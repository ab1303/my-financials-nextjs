# Bank Assets Database Migration Checklist

## ⚠️ PRE-MIGRATION CHECKLIST

Before running the database migration, ensure:

- [ ] **PowerShell 6+ is installed**
  - Check version: `pwsh --version`
  - If not installed: https://aka.ms/powershell
  - Or: `winget install Microsoft.PowerShell`

- [ ] **Development server is stopped**
  - Stop `pnpm run dev` if running
  - Close any terminal running Next.js
  - Verify no Node processes: `Get-Process -Name node`

- [ ] **Database connection is working**
  - Check `.env` file has `DATABASE_URL`
  - Verify PostgreSQL is running
  - Test connection if needed

- [ ] **Recent backup exists (if production data)**
  - For dev environment, this is optional
  - For production, ALWAYS backup first
  - Document backup location

- [ ] **All code changes are committed**
  - Commit Prisma schema changes
  - Commit new service/controller files
  - Clean working directory

---

## 🚀 MIGRATION STEPS

### Step 1: Stop Development Server

```powershell
# If running pnpm run dev, press Ctrl+C
# Or find and stop Node processes
Get-Process -Name node | Stop-Process -Force
```

**Verification:**

```powershell
Get-Process -Name node
# Should return nothing
```

### Step 2: Run Migration Script

```powershell
# Navigate to project root
cd "c:\My Github\my-financials-nextjs.worktrees\copilot-worktree-2026-01-31T23-14-13"

# Run the migration script
.\scripts\migrate-bank-assets.ps1
```

**What the script does:**

1. Checks for running Node processes
2. Runs `pnpm prisma migrate dev --name add_bank_assets_models`
3. Generates Prisma client with `pnpm prisma generate`
4. Provides success/failure feedback

### Step 3: Verify Migration Success

**Check migration files created:**

```powershell
ls .\prisma\migrations\
# Should see a new folder: YYYYMMDDHHMMSS_add_bank_assets_models
```

**Check migration SQL:**

```powershell
cat .\prisma\migrations\*add_bank_assets_models*\migration.sql
# Should see CREATE TABLE statements for:
# - BankAccount
# - BankAssetSnapshot
# - BankAssetEntry
```

**Verify Prisma client generated:**

```powershell
ls node_modules\.prisma\client\
# Should contain generated files
```

### Step 4: Restart Development Server

```powershell
pnpm run dev
```

**Verification:**

- Server starts without errors
- No Prisma client errors
- Application loads normally

---

## ✅ POST-MIGRATION VERIFICATION

### Database Schema Verification

```powershell
# Run Prisma Studio to inspect tables
pnpm prisma studio
```

**Check that these tables exist:**

- [ ] `BankAccount`
- [ ] `BankAssetSnapshot`
- [ ] `BankAssetEntry`

**Verify relationships:**

- [ ] BankAccount → Business (bank)
- [ ] BankAccount → User
- [ ] BankAssetSnapshot → User
- [ ] BankAssetEntry → BankAccount
- [ ] BankAssetEntry → BankAssetSnapshot

### API Endpoint Verification

**Test in browser/Postman/code:**

```typescript
// Test 1: Check tRPC router is registered
// Open dev tools console on your app
console.log(window.__trpc);
// Should include 'bankAsset' in the list

// Test 2: Try querying bank accounts (should return empty array initially)
const accounts = await fetch(
  '/api/trpc/bankAsset.getBankAccounts?input={}',
).then((r) => r.json());
console.log(accounts); // []

// Test 3: TypeScript types are available
import type { BankAccount } from '@prisma/client';
// Should not show error
```

### Type Safety Verification

```powershell
# Run TypeScript check
pnpm run build
```

**Should succeed with:**

- [ ] No TypeScript errors
- [ ] No Prisma client errors
- [ ] Build completes successfully

---

## 🐛 TROUBLESHOOTING

### Issue: EPERM Error During Migration

**Symptom:** `EPERM: operation not permitted`

**Solution:**

1. Stop ALL Node.js processes
2. Close VS Code and any IDEs
3. Check Task Manager for lingering Node processes
4. Retry migration

```powershell
# Force stop all Node processes
Stop-Process -Name node -Force

# Wait a few seconds
Start-Sleep -Seconds 3

# Retry migration
.\scripts\migrate-bank-assets.ps1
```

### Issue: PowerShell Script Execution Disabled

**Symptom:** `cannot be loaded because running scripts is disabled`

**Solution:**

```powershell
# Check current policy
Get-ExecutionPolicy

# Set to RemoteSigned (run as Administrator)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Retry migration
.\scripts\migrate-bank-assets.ps1
```

### Issue: Database Connection Error

**Symptom:** `Can't reach database server`

**Solution:**

1. Check PostgreSQL is running
2. Verify DATABASE_URL in `.env`
3. Test connection:

```powershell
# Check if PostgreSQL service is running (Windows)
Get-Service -Name postgresql*

# Test connection with Prisma
pnpm prisma db pull
```

### Issue: Migration Already Applied

**Symptom:** `Migration ... already applied`

**Solution:**
This is usually fine. The migration is already in your database.

```powershell
# Generate Prisma client only
pnpm prisma generate
```

### Issue: Conflicting Migration

**Symptom:** `Drift detected` or `Schema doesn't match database`

**Solution:**

```powershell
# View migration status
pnpm prisma migrate status

# If in dev environment and OK to reset:
pnpm prisma migrate reset

# ⚠️ WARNING: This deletes all data!
# For production, use manual migration repair
```

---

## 🔄 ROLLBACK (If Needed)

If something goes wrong and you need to rollback:

### Option 1: Reset (Dev Only - Deletes Data)

```powershell
# ⚠️ WARNING: This deletes ALL database data
pnpm prisma migrate reset
```

### Option 2: Manual Rollback (Production)

```sql
-- Connect to database and run:
DROP TABLE IF EXISTS "BankAssetEntry" CASCADE;
DROP TABLE IF EXISTS "BankAssetSnapshot" CASCADE;
DROP TABLE IF EXISTS "BankAccount" CASCADE;

-- Delete migration record
DELETE FROM "_prisma_migrations"
WHERE migration_name LIKE '%add_bank_assets_models%';
```

Then modify `schema.prisma` to remove the new models and run:

```powershell
pnpm prisma migrate dev --name rollback_bank_assets
```

---

## 📋 POST-MIGRATION TASKS

After successful migration:

- [ ] Commit migration files:

  ```powershell
  git add prisma/migrations/
  git commit -m "Add bank assets database migration"
  ```

- [ ] Update team/documentation that migration is complete

- [ ] Test creating a bank account via UI or API:

  ```typescript
  await trpc.bankAsset.createBankAccount.mutate({
    name: 'Test Savings',
    bankId: '<existing_bank_id>',
  });
  ```

- [ ] Verify no console errors in application

- [ ] Mark Phase 1 as complete in PRD ✅

- [ ] Ready to start Phase 2: UI Development 🎨

---

## 🎉 SUCCESS INDICATORS

You'll know migration succeeded when:

✅ Migration script completes without errors  
✅ New tables visible in Prisma Studio  
✅ Development server starts without errors  
✅ `pnpm run build` succeeds  
✅ TypeScript recognizes new Prisma types  
✅ tRPC endpoints are accessible  
✅ No console errors in application

---

## 📞 GET HELP

If you encounter issues:

1. Check this checklist's troubleshooting section
2. Review migration logs in `prisma/migrations/`
3. Check DATABASE_URL connection string
4. Verify PostgreSQL is running and accessible
5. Review Prisma documentation: https://www.prisma.io/docs

---

## ⏭️ NEXT STEPS

After successful migration:

1. **Phase 2: UI Development**
   - Create page: `app/(authorized)/assets/banks/page.tsx`
   - Implement calendar year selector
   - Build accordion components
   - Display snapshot data

2. **Test API Endpoints**
   - Create test accounts
   - Create test snapshots
   - Verify aggregation works

3. **Continue with PRD Implementation**
   - Follow Phase 2 tasks
   - Reference quick-reference.md for API usage
   - Use type definitions from bank-asset.types.ts

---

**Checklist Version**: 1.0  
**Last Updated**: 2026-01-31  
**Status**: Phase 1 Complete - Ready for Migration ✅
