import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const voluntaryCount = await prisma.voluntaryDonation.count();
  const interestCount = await prisma.interestCleansing.count();
  const zakatCount = await prisma.zakatPayment.count();
  
  console.log(`VoluntaryDonation count: ${voluntaryCount}`);
  console.log(`InterestCleansing count: ${interestCount}`);
  console.log(`ZakatPayment count: ${zakatCount}`);
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
