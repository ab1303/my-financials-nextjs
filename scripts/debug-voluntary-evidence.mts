import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const payments = await prisma.donationPayment.findMany({
    where: { donationPurpose: 'VOLUNTARY' },
    include: { evidence: true },
  });
  
  console.log(`Found ${payments.length} legacy VOLUNTARY DonationPayment rows.`);

  for (const p of payments) {
    if (p.evidence && p.evidence.length > 0) {
      console.log(`VOLUNTARY DonationPayment ${p.id} has ${p.evidence.length} evidence rows.`);
    }
  }
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
