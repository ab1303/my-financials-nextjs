'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import InterestCreditsTable from '../InterestCreditsTable';
import type { MonthlyCredit } from '../_types';

type CreditsDialogProps = {
  bankName: string;
  credits: MonthlyCredit[];
  bankId: string;
  calendarYearId: string;
};

export default function CreditsDialog({ bankName, credits, bankId, calendarYearId }: CreditsDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">View Interest Credits</Button>
      </DialogTrigger>
      <DialogContent className='max-w-4xl max-h-[80vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{bankName} Interest Credits</DialogTitle>
        </DialogHeader>
        <InterestCreditsTable
          credits={credits}
        />
      </DialogContent>
    </Dialog>
  );
}
