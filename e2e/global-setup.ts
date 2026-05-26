import {
  PrismaClient,
  CalendarEnumType,
  TransactionTypeEnum,
  TransactionStatusEnum,
  TransactionSourceEnum,
  BusinessEnumType,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

async function globalSetup() {
  // Use test database from environment
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL environment variable not set. Set it to test database URL.',
    );
  }

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  try {
    console.log('🔧 Running global setup...');

    // Seed test user
    console.log('👤 Seeding test user...');
    const hashedPassword = await bcrypt.hash('TestPassword123!', 10);

    const testUser = await prisma.user.upsert({
      where: { email: 'test@example.com' },
      update: {
        password: hashedPassword,
      },
      create: {
        email: 'test@example.com',
        name: 'Test User',
        password: hashedPassword,
      },
    });

    console.log(`✅ Test user created/updated: ${testUser.id}`);

    // Optionally seed reference data for relation tests
    console.log('📋 Seeding reference data...');

    // Check if business exists and create if not
    let business = await prisma.business.findFirst({
      where: {
        name: 'Test Business',
        userId: testUser.id,
      },
    });

    if (!business) {
      business = await prisma.business.create({
        data: {
          userId: testUser.id,
          name: 'Test Business',
        },
      });
    }

    // Check if individual exists and create if not
    let individual = await prisma.individual.findFirst({
      where: {
        name: 'Test Individual',
        userId: testUser.id,
      },
    });

    if (!individual) {
      individual = await prisma.individual.create({
        data: {
          userId: testUser.id,
          name: 'Test Individual',
        },
      });
    }

    console.log(
      `✅ Reference data seeded: Business(${business.id}), Individual(${individual.id})`,
    );

    // -------------------------------------------------------------------------
    // Seed transfer-integrity test data (idempotent — upsert with fixed IDs)
    // Provides deterministic data for e2e tests in e2e/cashflow/transfer-*.spec.ts
    // -------------------------------------------------------------------------
    console.log('💸 Seeding transfer-integrity test data for e2e tests...');

    // Ensure FY2026 calendar year exists (Jul 2025 – Jun 2026)
    let calendarYear = await prisma.calendarYear.findFirst({
      where: { fromYear: 2025, toYear: 2026, type: CalendarEnumType.FISCAL },
    });
    if (!calendarYear) {
      calendarYear = await prisma.calendarYear.create({
        data: {
          description: 'FY2026 (Jul 2025 - Jun 2026)',
          fromYear: 2025,
          fromMonth: 7,
          toYear: 2026,
          toMonth: 6,
          type: CalendarEnumType.FISCAL,
        },
      });
    }

    // Bank account linked to Test Business
    let bankAccount = await prisma.financialAccount.findFirst({
      where: { userId: testUser.id, name: 'E2E Test Checking' },
    });

    // E2E Test Bank as a BANK-type Business (appears in bank filter dropdown)
    let e2eTestBank = await prisma.business.findFirst({
      where: { name: 'E2E Test Bank', type: BusinessEnumType.BANK },
    });
    if (!e2eTestBank) {
      e2eTestBank = await prisma.business.create({
        data: {
          name: 'E2E Test Bank',
          type: BusinessEnumType.BANK,
          // userId is null for global BANK institutions
        },
      });
    }

    if (!bankAccount) {
      bankAccount = await prisma.financialAccount.create({
        data: {
          name: 'E2E Test Checking',
          institutionId: e2eTestBank.id,
          userId: testUser.id,
        },
      });
    }

    // Regular expense transactions (CONFIRMED DEBIT, non-Transfer)
    await prisma.transaction.upsert({
      where: { id: 'e2e-expense-groceries-fy26' },
      update: {},
      create: {
        id: 'e2e-expense-groceries-fy26',
        date: new Date('2025-08-15'),
        description: 'Woolworths Groceries',
        amount: 100.0,
        type: TransactionTypeEnum.DEBIT,
        category: 'Groceries',
        status: TransactionStatusEnum.CONFIRMED,
        source: TransactionSourceEnum.USER_MANUAL,
        userId: testUser.id,
        bankAccountId: bankAccount.id,
      },
    });

    await prisma.transaction.upsert({
      where: { id: 'e2e-expense-utilities-fy26' },
      update: {},
      create: {
        id: 'e2e-expense-utilities-fy26',
        date: new Date('2025-09-10'),
        description: 'AGL Utilities',
        amount: 200.0,
        type: TransactionTypeEnum.DEBIT,
        category: 'Utilities',
        status: TransactionStatusEnum.CONFIRMED,
        source: TransactionSourceEnum.USER_MANUAL,
        userId: testUser.id,
        bankAccountId: bankAccount.id,
      },
    });

    // Transfer — orphan (Aug 2025, no linked counterpart, well past 30-day cutoff)
    // Reset orphanResolution to null each run so Wave 3 resolution tests start clean
    await prisma.transaction.upsert({
      where: { id: 'e2e-transfer-orphan-fy26' },
      update: { category: 'Transfer', transferLinkedTransactionId: null, bankAccountId: bankAccount.id },
      create: {
        id: 'e2e-transfer-orphan-fy26',
        date: new Date('2025-08-01'),
        description: 'TRANSFER OUT - SAVINGS',
        amount: 1000.0,
        type: TransactionTypeEnum.DEBIT,
        category: 'Transfer',
        status: TransactionStatusEnum.CONFIRMED,
        source: TransactionSourceEnum.USER_MANUAL,
        userId: testUser.id,
        bankAccountId: bankAccount.id,
        transferLinkedTransactionId: null,
      },
    });

    // Transfer — mid-year (Oct 2025, no linked counterpart, also past 30-day cutoff)
    // Reset orphanResolution each run so Wave 3 tests can resolve it fresh
    await prisma.transaction.upsert({
      where: { id: 'e2e-transfer-midyear-fy26' },
      update: { category: 'Transfer', transferLinkedTransactionId: null, bankAccountId: bankAccount.id },
      create: {
        id: 'e2e-transfer-midyear-fy26',
        date: new Date('2025-10-01'),
        description: 'Transfer to Offset Account',
        amount: 500.0,
        type: TransactionTypeEnum.DEBIT,
        category: 'Transfer',
        status: TransactionStatusEnum.CONFIRMED,
        source: TransactionSourceEnum.USER_MANUAL,
        userId: testUser.id,
        bankAccountId: bankAccount.id,
        transferLinkedTransactionId: null,
      },
    });

    console.log(
      `✅ Transfer-integrity test data seeded: FY2026(${calendarYear.id}), Bank(${e2eTestBank.id}), Account(${bankAccount.id})`,
    );
    console.log(
      '   Test assertions: totalExpense=300, transferCount=2, transferTotal=1500, orphanCount=2',
    );

    // Explicitly reset orphanResolution to null AND category to 'Transfer' for both seeded orphans
    // (Prisma upsert update block silently ignores unrecognised typed fields)
    // Also resets category in case orphan-resolution tests reclassified them (EXPENSE/INCOME)
    await (prisma.transaction as any).updateMany({
      where: { id: { in: ['e2e-transfer-orphan-fy26', 'e2e-transfer-midyear-fy26'] } },
      data: { orphanResolution: null, category: 'Transfer' },
    });
    console.log('✅ Orphan resolutions reset to null for Wave 3 tests');

    // -------------------------------------------------------------------------
    // Seed second bank account for isTracked (Wave 4) tests
    // -------------------------------------------------------------------------
    let secondBankAccount = await prisma.financialAccount.findFirst({
      where: { userId: testUser.id, name: 'E2E Savings Account' },
    });
    if (!secondBankAccount) {
      secondBankAccount = await prisma.financialAccount.create({
        data: {
          name: 'E2E Savings Account',
          institutionId: e2eTestBank.id,
          userId: testUser.id,
          isTracked: true,
        },
      });
    } else {
      // Always reset to isTracked=true so toggle tests start from known state
      await prisma.financialAccount.update({
        where: { id: secondBankAccount.id },
        data: { isTracked: true },
      });
    }
    console.log(`✅ Second bank account seeded/reset: ${secondBankAccount.id} (isTracked=true)`);
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

export default globalSetup;
