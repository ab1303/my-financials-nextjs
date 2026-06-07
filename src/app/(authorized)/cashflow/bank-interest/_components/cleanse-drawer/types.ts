import { BeneficiaryEnumType } from '@prisma/client';
import { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { linkedModeSchema, manualModeSchema } from './schemas';

export type DrawerMode = 'linked' | 'manual';

export type TransactionRow = {
  id: string;
  date: string;
  description: string;
  amount: number;
  cleansedAmount: number;
};

export type BeneficiaryOption = { value: string; label: string };

export type LinkedFormValues = z.infer<typeof linkedModeSchema>;
export type ManualFormValues = z.infer<typeof manualModeSchema>;

export type EvidenceItem = {
  id: string;
  amount: number;
  description: string;
  date?: Date;
  score: number;
};

export type CleanseDonationDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  bankId: string;
  calendarYearId: string;
  dateFrom: string;
  dateTo: string;
  onDonationSaved: () => void;
  layoutMode?: 'full' | 'offset';
};

export type Suggestion = {
  donationPaymentId: string;
  donationTransactionId: string | null;
  evidenceAmount: number;
  score: number;
  suggestedAmount: number;
};
