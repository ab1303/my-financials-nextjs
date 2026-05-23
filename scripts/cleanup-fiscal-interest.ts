/**
 * Cleanup script: Delete broken BankInterestLiability records created with old month calculation bug
 * 
 * Bug: createYearlyBankInterestDetails used `month: i` (1-12 loop counter) instead of `month: currentMonth` (actual calendar month)
 * Impact: Fiscal year records have wrong months (1-12 instead of 7-12, 1-6 for Jul-Jun fiscal)
 * 
 * This script:
 * 1. Finds all FISCAL calendar years (type='FISCAL')
 * 2. Deletes their BankInterestLiability records
 * 3. User re-initializes via UI (with fixed month calculation)
 * 
 * Safe: Only deletes fiscal year records, preserves annual years
 */

import { prisma } from '@/server/utils/prisma';

async function cleanupFiscalYearRecords() {
  console.log('🔍 Finding FISCAL calendar years with BankInterestLiability records...');

  const fiscalCalendars = await prisma.calendarYear.findMany({
    where: { type: 'FISCAL' },
    include: {
      bankInterestLiabilities: {
        select: { id: true, month: true, year: true, bankId: true }
      }
    }
  });

  console.log(`Found ${fiscalCalendars.length} FISCAL calendar years`);

  let totalDeleted = 0;

  for (const calendar of fiscalCalendars) {
    const liabilityCount = calendar.bankInterestLiabilities.length;
    
    if (liabilityCount === 0) {
      console.log(`  ✓ ${calendar.type} ${calendar.fromYear}-${calendar.toYear}: No records to clean`);
      continue;
    }

    // Delete all BankInterestLiability records for this fiscal year
    const deleteResult = await prisma.bankInterestLiability.deleteMany({
      where: { calendarId: calendar.id }
    });

    totalDeleted += deleteResult.count;
    console.log(`  ✓ ${calendar.type} ${calendar.fromYear}-${calendar.toYear}: Deleted ${deleteResult.count} records`);
  }

  console.log(`\n✅ Cleanup complete: Deleted ${totalDeleted} broken fiscal year records`);
  console.log('\n📝 Next step: Navigate to Bank Interest page and click + to re-initialize fiscal years with correct months\n');
}

cleanupFiscalYearRecords()
  .catch((error) => {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  })
  .finally(() => process.exit(0));
