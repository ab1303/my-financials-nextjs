import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const orphaned = await prisma.incomeRecord.findMany({
    where: { transactionId: null },
    include: {
      incomeLedger: true,
    },
  });

  console.log(`Found ${orphaned.length} unlinked IncomeRecords`);
  let linked = 0;
  let skipped = 0;

  for (const record of orphaned) {
    const userId = record.incomeLedger.userId;

    const candidates = await prisma.transaction.findMany({
      where: {
        userId,
        type: 'CREDIT',
        status: 'CONFIRMED',
        date: record.dateEarned,
        amount: record.amount,
        incomeRecord: null,
      },
    });

    if (candidates.length === 1) {
      await prisma.incomeRecord.update({
        where: { id: record.id },
        data: { transactionId: candidates[0]!.id },
      });
      linked++;
    } else {
      console.warn(
        `Skipped IncomeRecord ${record.id}: ${candidates.length} candidates (userId=${userId})`,
      );
      skipped++;
    }
  }

  console.log(`Linked: ${linked}, Skipped: ${skipped}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
