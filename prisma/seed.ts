/**
 * Seed script — safe, idempotent reference data for a fresh database.
 *
 * Covers:
 *  - CalendarYears  (FISCAL, ANNUAL)
 *  - ExpenseCategories
 *  - SpecialCategories
 *  - Bank institutions   (Business.type = BANK,      userId = null)
 *  - Brokerage institutions (Business.type = BROKERAGE, userId = null)
 *
 * Run:  pnpm prisma db seed
 * Safe: uses upsert / findFirst+create so re-running never duplicates rows.
 */

import {
  PrismaClient,
  CalendarEnumType,
  BusinessEnumType,
} from '@prisma/client';

const prisma = new PrismaClient();

// ─── Calendar Years ────────────────────────────────────────────────────────────

/** Australian fiscal year: 1 July → 30 June */
const FISCAL_YEARS = [
  {
    description: 'FY 2023-24',
    fromYear: 2023,
    fromMonth: 7,
    toYear: 2024,
    toMonth: 6,
  },
  {
    description: 'FY 2024-25',
    fromYear: 2024,
    fromMonth: 7,
    toYear: 2025,
    toMonth: 6,
  },
  {
    description: 'FY 2025-26',
    fromYear: 2025,
    fromMonth: 7,
    toYear: 2026,
    toMonth: 6,
  },
];

/** Calendar (ANNUAL) year: 1 Jan → 31 Dec */
const ANNUAL_YEARS = [
  {
    description: '2024',
    fromYear: 2024,
    fromMonth: 1,
    toYear: 2024,
    toMonth: 12,
  },
  {
    description: '2025',
    fromYear: 2025,
    fromMonth: 1,
    toYear: 2025,
    toMonth: 12,
  },
  {
    description: '2026',
    fromYear: 2026,
    fromMonth: 1,
    toYear: 2026,
    toMonth: 12,
  },
];

async function seedCalendarYears() {
  console.log('\n📅 Seeding Calendar Years...');
  let created = 0;

  for (const cy of FISCAL_YEARS) {
    const existing = await prisma.calendarYear.findFirst({
      where: { description: cy.description, type: CalendarEnumType.FISCAL },
    });
    if (!existing) {
      await prisma.calendarYear.create({
        data: { ...cy, type: CalendarEnumType.FISCAL },
      });
      console.log(`  ✓ ${cy.description} (FISCAL)`);
      created++;
    } else {
      console.log(`  - ${cy.description} (FISCAL) already exists`);
    }
  }

  for (const cy of ANNUAL_YEARS) {
    const existing = await prisma.calendarYear.findFirst({
      where: { description: cy.description, type: CalendarEnumType.ANNUAL },
    });
    if (!existing) {
      await prisma.calendarYear.create({
        data: { ...cy, type: CalendarEnumType.ANNUAL },
      });
      console.log(`  ✓ ${cy.description} (ANNUAL)`);
      created++;
    } else {
      console.log(`  - ${cy.description} (ANNUAL) already exists`);
    }
  }

  console.log(`  → ${created} calendar year(s) created`);
}

// ─── Expense Categories ────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = [
  { name: 'Shopping', iconName: 'shopping-bag' },
  { name: 'Groceries', iconName: 'shopping-cart' },
  { name: 'Eating out & takeaway', iconName: 'utensils' },
  { name: 'Entertainment', iconName: 'theater-masks' },
  { name: 'Home', iconName: 'home' },
  { name: 'Utilities', iconName: 'lightbulb' },
  { name: 'Cash', iconName: 'wallet' },
  { name: 'Gifts & donations', iconName: 'gift' },
  { name: 'Vehicle & transport', iconName: 'car' },
  { name: 'Health & medical', iconName: 'heart-pulse' },
  { name: 'Education', iconName: 'book' },
  { name: 'Travel & holidays', iconName: 'plane' },
  { name: 'Childcare', iconName: 'baby' },
  { name: 'Tax paid', iconName: 'receipt' },
  { name: 'Sport & fitness', iconName: 'dumbbell' },
  { name: 'Personal care', iconName: 'sparkles' },
  { name: 'Insurance', iconName: 'shield' },
  { name: 'Fees & interest', iconName: 'percent' },
  { name: 'Business', iconName: 'briefcase' },
  { name: 'Home loan', iconName: 'house' },
  { name: 'Pets', iconName: 'paw' },
  { name: 'Professional services', iconName: 'handshake' },
];

async function seedExpenseCategories() {
  console.log('\n🏷️  Seeding Expense Categories...');
  let created = 0;

  for (const cat of EXPENSE_CATEGORIES) {
    await prisma.expenseCategory.upsert({
      where: { name: cat.name },
      create: cat,
      update: { iconName: cat.iconName }, // refresh icon if renamed
    });
    console.log(`  ✓ ${cat.name}`);
    created++;
  }

  console.log(`  → ${created} expense category/categories upserted`);
}

// ─── Special Categories ────────────────────────────────────────────────────────

const SPECIAL_CATEGORIES = [
  {
    name: 'Transfer',
    description:
      'Money moved between your own accounts. Excluded from income and expense totals.',
    isEditable: false,
    color: 'blue',
  },
  {
    name: 'Excluded',
    description:
      'Transaction intentionally excluded from all reporting (e.g. refunds, reversals).',
    isEditable: false,
    color: 'gray',
  },
  {
    name: 'Income',
    description:
      'Inbound amount classified as income. Linked to the Income module.',
    isEditable: false,
    color: 'green',
  },
  {
    name: 'Donation',
    description:
      'Charitable donation or zakat payment. Linked to the Philanthropy module.',
    isEditable: false,
    color: 'purple',
  },
];

async function seedSpecialCategories() {
  console.log('\n⭐ Seeding Special Categories...');
  let created = 0;

  for (const cat of SPECIAL_CATEGORIES) {
    await prisma.specialCategory.upsert({
      where: { name: cat.name },
      create: { ...cat, isActive: true },
      update: { description: cat.description, color: cat.color },
    });
    console.log(`  ✓ ${cat.name}`);
    created++;
  }

  console.log(`  → ${created} special category/categories upserted`);
}

// ─── Bank Institutions ─────────────────────────────────────────────────────────

const BANKS = [
  { name: 'Commonwealth Bank (CBA)' },
  { name: 'Westpac' },
  { name: 'ANZ' },
  { name: 'NAB' },
  { name: 'Macquarie Bank' },
  { name: 'ING' },
  { name: 'Bendigo Bank' },
  { name: 'HSBC Australia' },
  { name: 'St George Bank' },
  { name: 'Bank of Queensland (BOQ)' },
  { name: 'Suncorp Bank' },
  { name: 'Bankwest' },
  { name: 'AMP Bank' },
  { name: 'ME Bank' },
  { name: 'Up Bank' },
  { name: 'Ubank' },
];

async function seedBanks() {
  console.log('\n🏦 Seeding Bank Institutions...');
  let created = 0;

  for (const bank of BANKS) {
    const existing = await prisma.business.findFirst({
      where: { name: bank.name, type: BusinessEnumType.BANK, userId: null },
    });
    if (!existing) {
      await prisma.business.create({
        data: { ...bank, type: BusinessEnumType.BANK, userId: null },
      });
      console.log(`  ✓ ${bank.name}`);
      created++;
    } else {
      console.log(`  - ${bank.name} already exists`);
    }
  }

  console.log(`  → ${created} bank(s) created`);
}

// ─── Brokerage Institutions ────────────────────────────────────────────────────

const BROKERAGES = [
  { name: 'CommSec' },
  { name: 'SelfWealth' },
  { name: 'Stake' },
  { name: 'Interactive Brokers' },
  { name: 'CMC Markets' },
  { name: 'Superhero' },
  { name: 'Pearler' },
  { name: 'Sharesies' },
];

async function seedBrokerages() {
  console.log('\n📈 Seeding Brokerage Institutions...');
  let created = 0;

  for (const brokerage of BROKERAGES) {
    const existing = await prisma.business.findFirst({
      where: {
        name: brokerage.name,
        type: BusinessEnumType.BROKERAGE,
        userId: null,
      },
    });
    if (!existing) {
      await prisma.business.create({
        data: { ...brokerage, type: BusinessEnumType.BROKERAGE, userId: null },
      });
      console.log(`  ✓ ${brokerage.name}`);
      created++;
    } else {
      console.log(`  - ${brokerage.name} already exists`);
    }
  }

  console.log(`  → ${created} brokerage(s) created`);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Starting seed...');

  await seedCalendarYears();
  await seedExpenseCategories();
  await seedSpecialCategories();
  await seedBanks();
  await seedBrokerages();

  console.log('\n✅ Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
