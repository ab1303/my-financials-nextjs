import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestData() {
  try {
    // First we need a user to associate with our test data
    let user = await prisma.user.findFirst();
    if (!user) {
      console.log(
        'No existing user found. Please create a user through the application first.',
      );
      console.log(
        'This script requires an existing user to associate test data with.',
      );
      return;
    } else {
      console.log('Found existing user:', user.email);
    }

    // Check if we have any calendar years
    const existingYears = await prisma.calendarYear.findMany({
      where: { type: 'ZAKAT' },
    });

    if (existingYears.length === 0) {
      console.log('Creating test calendar year...');

      // Create a calendar year for 2025
      const calendarYear = await prisma.calendarYear.create({
        data: {
          description: '2025 Fiscal Year',
          fromYear: 2025,
          fromMonth: 1,
          toYear: 2025,
          toMonth: 12,
          type: 'ZAKAT',
        },
      });

      console.log('Created calendar year:', calendarYear);
    } else {
      console.log('Found existing calendar years:', existingYears.length);
    }

    // Check for individuals
    const existingIndividuals = await prisma.individual.findMany({
      where: { userId: user.id },
    });
    if (existingIndividuals.length === 0) {
      console.log('Creating test individual...');

      const individual = await prisma.individual.create({
        data: {
          name: 'John Doe',
          firstName: 'John',
          lastName: 'Doe',
          userId: user.id,
        },
      });

      console.log('Created individual:', individual);
    } else {
      console.log('Found existing individuals:', existingIndividuals.length);
    }

    // Check for businesses
    const existingBusinesses = await prisma.business.findMany({
      where: {
        type: 'PHILANTHROPY',
        userId: user.id,
      },
    });
    if (existingBusinesses.length === 0) {
      console.log('Creating test business...');

      const business = await prisma.business.create({
        data: {
          name: 'Test Charity Foundation',
          type: 'PHILANTHROPY',
          addressLine: '123 Charity Street',
          userId: user.id,
        },
      });

      console.log('Created business:', business);
    } else {
      console.log(
        'Found existing philanthropy businesses:',
        existingBusinesses.length,
      );
    }

    console.log('Test data setup complete!');
  } catch (error) {
    console.error('Error creating test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestData();
