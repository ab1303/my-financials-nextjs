import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const payments = await prisma.donationPayment.findMany({
    include: { evidence: true },
  });
  console.log(`Found ${payments.length} legacy DonationPayment rows to migrate.`);

  for (const p of payments) {
    try {
      if (p.donationPurpose === 'INTEREST_CLEANSING') {
        // upsert InterestCleansing using original id to remain idempotent
        await prisma.interestCleansing.upsert({
          where: { id: p.id },
          update: { amount: p.amount, datePaid: p.datePaid },
          create: {
            id: p.id,
            amount: p.amount,
            datePaid: p.datePaid,
            donationLedgerId: p.donationLedgerId,
            creditTxId: p.interestTxId,
          },
        });
        for (const e of p.evidence) {
          await prisma.interestCleansingEvidence.upsert({
            where: {
              interestCleansingId_transactionId: {
                interestCleansingId: p.id,
                transactionId: e.evidenceTransactionId,
              },
            },
            update: { amountLinked: e.amountApplied },
            create: {
              id: e.id,
              interestCleansingId: p.id,
              transactionId: e.evidenceTransactionId,
              amountLinked: e.amountApplied,
              confidence: e.confidence ?? 0,
            },
          });
        }
      } else if (p.donationPurpose === 'ZAKAT') {
        await prisma.zakatPayment.upsert({
          where: { id: p.id },
          update: { amount: p.amount, datePaid: p.datePaid },
          create: {
            id: p.id,
            amount: p.amount,
            datePaid: p.datePaid,
            zakatObligationId: p.donationLedgerId,
            beneficiaryType: p.beneficiaryType,
            businessId: p.businessId,
            individualId: p.individualId,
          },
        });
        for (const e of p.evidence) {
          await prisma.zakatEvidence.upsert({
            where: {
              zakatPaymentId_transactionId: {
                zakatPaymentId: p.id,
                transactionId: e.evidenceTransactionId,
              },
            },
            update: { amountLinked: e.amountApplied },
            create: {
              id: e.id,
              zakatPaymentId: p.id,
              transactionId: e.evidenceTransactionId,
              amountLinked: e.amountApplied,
              confidence: e.confidence ?? 0,
            },
          });
        }
      } else {
        // VOLUNTARY
        await prisma.voluntaryDonation.upsert({
          where: { id: p.id },
          update: { amount: p.amount, datePaid: p.datePaid },
          create: {
            id: p.id,
            amount: p.amount,
            datePaid: p.datePaid,
            donationLedgerId: p.donationLedgerId,
            beneficiaryType: p.beneficiaryType,
            businessId: p.businessId,
            individualId: p.individualId,
          },
        });
        for (const e of p.evidence) {
          await prisma.voluntaryDonationEvidence.upsert({
            where: {
              voluntaryDonationId_transactionId: {
                voluntaryDonationId: p.id,
                transactionId: e.evidenceTransactionId,
              },
            },
            update: { amountLinked: e.amountApplied },
            create: {
              id: e.id,
              voluntaryDonationId: p.id,
              transactionId: e.evidenceTransactionId,
              amountLinked: e.amountApplied,
              confidence: e.confidence ?? 0,
            },
          });
        }
      }
    } catch (error) {
        console.error(`Error migrating legacy donation ${p.id}:`, error);
        // Track error in MigrationAudit? For now, console log is sufficient based on spec.
    }
  }
  console.log("Migration completed.");
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
