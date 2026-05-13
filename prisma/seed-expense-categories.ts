import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const expenseCategories = [
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
  console.log('Seeding expense categories...');

  // First, delete all expense entries (they reference categories)
  const deletedEntries = await prisma.monthlyExpenseSummary.deleteMany({});
  console.log(`🗑️  Deleted ${deletedEntries.count} expense entries`);

  // Then, delete all old categories
  const deletedCount = await prisma.expenseCategory.deleteMany({});
  console.log(`🗑️  Deleted ${deletedCount.count} old categories`);

  // Finally, create all new categories
  for (const category of expenseCategories) {
    await prisma.expenseCategory.create({
      data: category,
    });
    console.log(`✓ ${category.name}`);
  }

  console.log('\n✓ Expense categories seeded successfully!');
}

seedExpenseCategories()
  .catch((e) => {
    console.error('Error seeding expense categories:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
