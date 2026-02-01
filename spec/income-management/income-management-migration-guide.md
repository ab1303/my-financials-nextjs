# Income Management - Migration Guide

## Overview

This guide helps existing users migrate to the new Income Management feature added in December 2025. The feature introduces comprehensive income tracking and analytical reporting capabilities.

## What's New

### New Database Tables

Two new tables have been added to the database:

1. **Income** - Parent record linking fiscal years to users
2. **IncomeEntry** - Individual income entries with date, amount, and source

### New Navigation Structure

The application now includes a new "Reports" section in the navigation menu:

**Before:**

```
CashFlow
├─ Bank Interest
├─ Donations
└─ (Income was not present)

Zakat
Settings
```

**After:**

```
CashFlow
├─ Bank Interest
├─ Donations
└─ Income (NEW)

Reports (NEW SECTION)
└─ Income Summary (NEW)

Zakat
Settings
```

### New Features

1. **Income Tracking Page** (`/cashflow/income`)
   - Record income entries by date, amount, and source
   - Inline editing capabilities
   - Real-time total calculation
   - Fiscal year filtering

2. **Income Summary Page** (`/reports/income-summary`)
   - Monthly aggregation views
   - Source breakdown analysis
   - Summary statistics
   - Expandable drill-down details

## Migration Steps

### 1. Database Migration

The database migration has already been applied if you're seeing this. The migration is **non-destructive** and adds new tables without affecting existing data.

**Migration File:** `20251231052609_add_income_models`

**What it does:**

- Creates `Income` table
- Creates `IncomeEntry` table with 7 income source types
- Adds foreign key relationships
- Sets up cascade deletes
- Creates necessary indexes

**To verify migration status:**

```bash
pnpm prisma migrate status
```

### 2. Fiscal Year Setup (Required)

Before using Income Management, ensure you have at least one Calendar Year with **type=FISCAL** configured.

**To check existing fiscal years:**

1. Log in to the application
2. Navigate to Settings → Calendar Year(s)
3. Verify at least one entry exists with type "FISCAL"

**To create a fiscal year:**

1. Go to Settings → Calendar Year(s)
2. Click "Add Calendar Year"
3. Fill in the details:
   - Description: e.g., "FY 2024-2025"
   - From: July 2024
   - To: June 2025
   - Type: **FISCAL** (important!)
4. Save

### 3. Navigation Update

The navigation menu now includes:

- **Income** link under CashFlow section
- New **Reports** section with **Income Summary** link

No action required - navigation is automatically updated.

### 4. Start Using Income Management

**To add income entries:**

1. Navigate to CashFlow → Income
2. Select a fiscal year from the dropdown
3. Click the "+" icon to add a new row
4. Fill in:
   - Date Earned (cannot be future date)
   - Amount (positive number, max 2 decimals)
   - Source (Employment, Stocks, Bonds, Rental, Business, Freelance, Other)
5. Click the save icon (floppy disk)

**To view income summary:**

1. Navigate to Reports → Income Summary
2. Select a fiscal year
3. View monthly aggregations
4. Click on any month to expand source breakdown

## Data Structure

### Income Sources

The following income source types are supported:

- **EMPLOYMENT** - Salary, wages, bonuses from employment
- **STOCKS** - Stock dividends, capital gains
- **BONDS** - Bond interest, coupon payments
- **RENTAL** - Rental property income
- **BUSINESS** - Business profits, self-employment income
- **FREELANCE** - Freelance work, consulting fees
- **OTHER** - Other income sources

### User Data Isolation

All income data is **user-scoped**:

- You can only see your own income entries
- Each user's data is completely isolated
- Authentication is required for all operations

## Rollback Instructions

If you need to rollback the Income Management feature (not recommended):

### Option 1: Keep Database Tables (Recommended)

Simply don't use the feature. The tables remain in the database but won't be used.

**Pros:**

- No data loss
- Can enable feature later without migration
- No risk to existing data

**Cons:**

- Empty tables remain in database

### Option 2: Remove Database Tables

⚠️ **WARNING: This will permanently delete all income data!**

```bash
# Create a manual migration to drop tables
pnpm prisma migrate dev --create-only --name remove_income_tables

# Edit the migration file to add:
# DROP TABLE "IncomeEntry";
# DROP TABLE "Income";

# Apply the migration
pnpm prisma migrate dev
```

## Troubleshooting

### "No fiscal years configured" message

**Problem:** Cannot add income entries  
**Solution:** Create at least one Calendar Year with type=FISCAL (see Step 2 above)

### Income entries not appearing

**Problem:** Entries save but don't show in table  
**Solution:**

- Verify you're viewing the correct fiscal year
- Refresh the page
- Check browser console for errors

### Session expired errors

**Problem:** "Your session has expired. Please log in again."  
**Solution:**

- Log out and log back in
- Check if authentication cookies are being blocked
- Clear browser cache and cookies

### Navigation menu doesn't show Income

**Problem:** Can't find Income or Reports links  
**Solution:**

- Clear browser cache
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Verify you're logged in with proper authentication

## Support

If you encounter issues not covered in this guide:

1. Check the browser console for error messages
2. Verify database migration status with `pnpm prisma migrate status`
3. Check application logs for server-side errors
4. Review the [Implementation Tracking Document](./income-management-implementation.md) for technical details

## Future Enhancements

Planned features for future releases:

- Export to CSV/PDF for tax filing
- Recurring income automation
- Multi-currency support
- Bank API integration for automatic import
- Charts and visualizations
- Budget vs actual comparison
- Income forecasting
- Mobile app support

## Summary

The Income Management feature is now available! Start by:

1. ✅ Verifying database migration is complete
2. ✅ Ensuring fiscal years are configured
3. ✅ Navigating to CashFlow → Income
4. ✅ Adding your first income entry
5. ✅ Viewing analytics in Reports → Income Summary

---

**Last Updated:** December 31, 2025  
**Version:** 1.0.0  
**Feature Status:** Production Ready ✅
