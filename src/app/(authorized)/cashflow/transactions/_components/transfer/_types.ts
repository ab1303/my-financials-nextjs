import type { TransferCandidateScore } from '@/server/services/transactions/_types';

export type TransferCandidates = TransferCandidateScore[];

export interface TransferLinkDrawerProps {
  open: boolean;
  onClose: () => void;
  sourceTransaction: {
    id: string;
    description: string;
    amount: number;
    type: 'DEBIT' | 'CREDIT';
    date: string;
    bankAccountName: string | null;
  };
  onLinked: () => void;
}

export interface UnmatchedTransfersBadgeProps {
  count: number;
}
