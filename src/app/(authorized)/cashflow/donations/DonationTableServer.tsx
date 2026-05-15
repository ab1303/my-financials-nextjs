import { donationPaymentsHandler } from '@/server/controllers/donation.controller';
import { DonationPaymentStateProvider } from './StateProvider';
import DonationTableClient from './DonationTableClient';
import { allIndividualDetailsHandler } from '@/server/controllers/individual.controller';
import { allBusinessDetailsHandler } from '@/server/controllers/business.controller';
import { auth } from '@/server/auth';

import type { DonationPaymentType } from './_types';
import type { OptionType } from '@/types';
import { addRow, deleteRow, editRow } from './actions';

export type DonationTableServerProps = {
  calendarYearId: string;
};

export default async function DonationPaymentsTableServer({
  calendarYearId,
}: DonationTableServerProps) {
  try {
    // Get user session for user-specific data
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('User session not found');
    }

    const donationPayments = await donationPaymentsHandler(calendarYearId);
    const individuals = await allIndividualDetailsHandler(session.user.id);
    const businesses = await allBusinessDetailsHandler(session.user.id);

    let individualsOptions: Array<OptionType> = [];
    if (individuals) {
      individualsOptions = individuals.map<OptionType>((i) => ({
        id: i.id,
        label: i.name,
      }));
    }

    let businessesOptions: Array<OptionType> = [];
    if (businesses) {
      businessesOptions = businesses.map<OptionType>((b) => ({
        id: b.id,
        label: b.name,
      }));
    }

    const data =
      donationPayments?.map<DonationPaymentType>((dp) => ({
        id: dp.id,
        amount: dp.amount,
        beneficiaryId:
          (dp.beneficiaryType === 'BUSINESS'
            ? dp.businessId
            : dp.individualId) || '',
        beneficiaryType: dp.beneficiaryType,
        taxCategory: dp.taxCategory,
        datePaid: dp.datePaid,
        transactionId: dp.transactionId ?? undefined,
      })) || [];

    return (
      <DonationPaymentStateProvider data={data}>
        <DonationTableClient
          individualsOptions={individualsOptions}
          businessesOptions={businessesOptions}
          addRow={addRow}
          editRow={editRow}
          deleteRow={deleteRow}
          calendarYearId={calendarYearId}
        />
      </DonationPaymentStateProvider>
    );
  } catch (error) {
    console.error('Error loading Donation table data:', error);
    return (
      <div className='p-4 bg-red-50 border border-red-200 rounded-md'>
        <p className='text-red-800 font-medium'>
          Failed to load Donation payments table
        </p>
        <p className='text-red-600 text-sm mt-1'>
          {error instanceof Error
            ? error.message
            : 'An unexpected error occurred'}
        </p>
        <p className='text-gray-600 text-xs mt-2'>
          Please refresh the page or contact support if the problem persists.
        </p>
      </div>
    );
  }
}
