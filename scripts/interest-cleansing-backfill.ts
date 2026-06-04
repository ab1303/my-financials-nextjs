import { PrismaClient, TransactionTypeEnum } from '@prisma/client';
import { scoreInterestMatch } from '../src/server/utils/interest-match';

const prisma = new PrismaClient();

async function backfill() {
  console.log('Starting interest cleansing backfill...');

  // 1. Find all "Credit Interest" transactions
  // Typically they have "Interest" in description and are CREDIT
  const interestCredits = await prisma.transaction.findMany({
    where: {
      type: TransactionTypeEnum.CREDIT,
      description: {
        contains: 'Interest',
        mode: 'insensitive',
      },
      // Not already linked to a DonationPayment
      donationPaymentInterest: {
        is: null,
      },
    },
    include: {
      user: true,
    },
  });

  console.log(`Found ${interestCredits.length} unlinked interest credits.`);

  for (const credit of interestCredits) {
    console.log(`Processing Credit: [${credit.date.toISOString().split('T')[0]}] ${credit.amount} - ${credit.description}`);

    // 2. Find candidate DEBIT transactions for this user
    // Date window: credit.date +/- 90 days
    const startDate = new Date(credit.date);
    startDate.setDate(startDate.getDate() - 90);
    const endDate = new Date(credit.date);
    endDate.setDate(endDate.getDate() + 90);

    const candidates = await prisma.transaction.findMany({
      where: {
        userId: credit.userId,
        type: TransactionTypeEnum.DEBIT,
        date: {
          gte: startDate,
          lte: endDate,
        },
        // Avoid transactions already fully used as evidence if we could track that...
        // For now, just find all potential debits.
      },
    });

    const matches = candidates.map(evidence => ({
      evidence,
      score: scoreInterestMatch(
        { amount: credit.amount, date: credit.date, description: credit.description },
        { amount: evidence.amount, date: evidence.date, description: evidence.description }
      ),
    }))
    .filter(m => m.score >= 0.60)
    .sort((a, b) => b.score - a.score);

    if (matches.length > 0) {
      const bestMatch = matches[0]!;
      console.log(`  Best candidate: [${bestMatch.evidence.date.toISOString().split('T')[0]}] ${bestMatch.evidence.amount} - ${bestMatch.evidence.description} (Score: ${bestMatch.score.toFixed(2)})`);

      if (bestMatch.score >= 0.85) {
        console.log(`  HIGH CONFIDENCE: Auto-applying match...`);
        
        // Find or create a DonationLedger for the calendar year of the credit
        // This is a bit complex as we need a CalendarYear record.
        const year = credit.date.getFullYear();
        let ledger = await prisma.donationLedger.findFirst({
          where: {
            calendar: {
              fromYear: { lte: year },
              toYear: { gte: year },
              // This is a simplification, should ideally match user's fiscal year
            }
          }
        });

        if (!ledger) {
          console.warn(`    No DonationLedger found for year ${year}. Skipping auto-apply.`);
          continue;
        }

        // Atomic transaction to create DonationPayment and its Evidence
        await prisma.$transaction(async (tx) => {
          const donation = await tx.donationPayment.create({
            data: {
              datePaid: bestMatch.evidence.date,
              amount: credit.amount, // Clean exactly the interest amount
              beneficiaryType: 'BUSINESS', // Assumption
              donationLedgerId: ledger!.id,
              interestTxId: credit.id,
              donationPurpose: 'INTEREST_CLEANSING',
            },
          });

          await tx.donationPaymentEvidence.create({
            data: {
              donationPaymentId: donation.id,
              evidenceTransactionId: bestMatch.evidence.id,
              amountApplied: credit.amount,
              confidence: bestMatch.score,
            },
          });
        });
        
        console.log(`    Successfully linked!`);
      } else {
        console.log(`  MEDIUM CONFIDENCE: Suggestion logged.`);
      }
    } else {
      console.log(`  No suitable candidates found.`);
    }
  }

  console.log('Backfill complete.');
}

backfill()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
