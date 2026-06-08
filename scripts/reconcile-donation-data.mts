import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  console.log("Verifying data integrity...");
  
  // 1. Compare total counts (Legacy DonationPayment vs New Domain Models)
  const legacyCount = await prisma.donationPayment.count();
  const newVoluntary = await prisma.voluntaryDonation.count();
  const newInterest = await prisma.interestCleansing.count();
  const newZakat = await prisma.zakatPayment.count();
  const totalNew = newVoluntary + newInterest + newZakat;
  
  console.log(`Legacy DonationPayment count: ${legacyCount}`);
  console.log(`New Domain Models total count: ${totalNew}`);
  
  if (legacyCount !== totalNew) {
    console.error("❌ Count mismatch!");
  } else {
    console.log("✅ Counts match.");
  }
  
  // 2. Sample comparison
  const sample = await prisma.donationPayment.findMany({ take: 5 });
  for (const p of sample) {
    let match = false;
    if (p.donationPurpose === 'VOLUNTARY') {
      match = await prisma.voluntaryDonation.findUnique({ where: { id: p.id } }) !== null;
    } else if (p.donationPurpose === 'INTEREST_CLEANSING') {
      match = await prisma.interestCleansing.findUnique({ where: { id: p.id } }) !== null;
    } else if (p.donationPurpose === 'ZAKAT') {
      match = await prisma.zakatPayment.findUnique({ where: { id: p.id } }) !== null;
    }
    
    if (!match) {
        console.error(`❌ Sample ${p.id} not found in new domain model.`);
    } else {
        console.log(`✅ Sample ${p.id} matched.`);
    }
  }
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
