import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const sourceCount = await prisma.donationPaymentEvidence.count();
  const targetCount = await prisma.voluntaryDonationEvidence.count();
  
  console.log(`Source DonationPaymentEvidence count: ${sourceCount}`);
  console.log(`Target VoluntaryDonationEvidence count: ${targetCount}`);
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
