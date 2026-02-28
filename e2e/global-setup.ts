import { PrismaClient } from '@prisma/client';
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
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

export default globalSetup;
