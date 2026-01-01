import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const expenseCategories = [
  { name: 'Housing' },
  { name: 'Utilities' },
  { name: 'Transportation' },
  { name: 'Food' },
  { name: 'Healthcare' },
  { name: 'Insurance' },
  { name: 'Entertainment' },
  { name: 'Education' },
  { name: 'Personal' },
  { name: 'Other' },
];

async function seedExpenseCategories() {
  console.log('Seeding expense categories...');

  for (const category of expenseCategories) {
    await prisma.expenseCategory.upsert({
      where: { name: category.name },
      update: {},
      create: category,
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
