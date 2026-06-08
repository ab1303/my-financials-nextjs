import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const donationPayments = await prisma.donationPayment.findMany();
  const zakatPayments = donationPayments.filter(p => p.donationPurpose === 'ZAKAT');
  console.log(`Legacy DonationPayment count: ${donationPayments.length}`);
  console.log(`Legacy ZakatPayment count: ${zakatPayments.length}`);
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
