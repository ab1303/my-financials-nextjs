import { getLinkedTransactionIds as getVoluntaryLinkedTransactionIds } from '@/server/services/voluntary-donations/voluntary-donation.service';
import { getLinkedTransactionIds as getZakatLinkedTransactionIds } from '@/server/services/zakat/zakat.service';
import { prisma } from '@/server/db/client';

export const DONATION_PURPOSES = {
  VOLUNTARY: 'VOLUNTARY',
  INTEREST_CLEANSING: 'INTEREST_CLEANSING',
  ZAKAT: 'ZAKAT',
} as const;

export type DonationPurpose = typeof DONATION_PURPOSES[keyof typeof DONATION_PURPOSES];

export async function getLinkedTransactionIds(purpose: DonationPurpose): Promise<Set<string>> {
  switch (purpose) {
    case DONATION_PURPOSES.VOLUNTARY: {
      return new Set(await getVoluntaryLinkedTransactionIds());
    }
    case DONATION_PURPOSES.INTEREST_CLEANSING: {
      const linked = await prisma.interestCleansingEvidence.findMany({
        select: { transactionId: true },
      });
      return new Set(linked.map((d) => d.transactionId));
    }
    case DONATION_PURPOSES.ZAKAT: {
      return new Set(await getZakatLinkedTransactionIds());
    }
    default:
      throw new Error(`Unknown donation purpose: ${purpose}`);
  }
}

export async function getAllLinkedTransactionIds(purposes: DonationPurpose[]): Promise<Set<string>> {
  const sets = await Promise.all(purposes.map(getLinkedTransactionIds));
  const allIds = new Set<string>();
  for (const set of sets) {
    for (const id of set) {
      allIds.add(id);
    }
  }
  return allIds;
}
