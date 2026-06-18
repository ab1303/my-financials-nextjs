'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

import type { MonthlyCredit } from '../_types';
import InterestCreditsTable from '../InterestCreditsTable';

type CreditsDialogProps = {
  bankName: string;
  credits: MonthlyCredit[];
  institutionId: string;
  calendarYearId: string;
};

export default function CreditsDialog({
  bankName,
  credits,
  institutionId,
  calendarYearId,
}: CreditsDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant='primary'>View Interest Credits</Button>
      </DialogTrigger>
      <DialogContent className='max-w-4xl max-h-[80vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{bankName} Interest Credits</DialogTitle>
        </DialogHeader>
        <InterestCreditsTable credits={credits} />
      </DialogContent>
    </Dialog>
  );
}
