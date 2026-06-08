import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const interestEvidenceCount = await prisma.interestCleansingEvidence.count();
  const voluntaryEvidenceCount = await prisma.voluntaryDonationEvidence.count();
  const zakatEvidenceCount = await prisma.zakatEvidence.count();
  
  console.log(`InterestCleansingEvidence count: ${interestEvidenceCount}`);
  console.log(`VoluntaryDonationEvidence count: ${voluntaryEvidenceCount}`);
  console.log(`ZakatEvidence count: ${zakatEvidenceCount}`);
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
