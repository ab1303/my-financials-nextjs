import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const payments = await prisma.donationPayment.findMany({
    include: { evidence: true },
  });
  
  console.log(`Found ${payments.length} legacy DonationPayment rows.`);

  let evidenceCount = 0;
  for (const p of payments) {
    if (p.evidence && p.evidence.length > 0) {
      console.log(`DonationPayment ${p.id} (purpose: ${p.donationPurpose}) has ${p.evidence.length} evidence rows.`);
      evidenceCount += p.evidence.length;
    }
  }
  console.log(`Total evidence rows found: ${evidenceCount}`);
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
