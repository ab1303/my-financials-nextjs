import { BeneficiaryEnumType } from '@prisma/client';

import { auth } from '@/server/auth';
import { allBusinessDetailsHandler } from '@/server/controllers/business.controller';
import { donationPaymentsHandler } from '@/server/controllers/donation.controller';
import { allIndividualDetailsHandler } from '@/server/controllers/individual.controller';
import type { OptionType } from '@/types';

import type { DonationPaymentType } from './_types';
import { addRow, deleteRow, editRow } from './actions';
import DonationTableClient from './DonationTableClient';
import { DonationPaymentStateProvider } from './StateProvider';

export type DonationTableServerProps = {
  calendarYearId: string;
  beneficiaryId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export default async function DonationPaymentsTableServer({
  calendarYearId,
  beneficiaryId,
  dateFrom,
  dateTo,
}: DonationTableServerProps) {
  try {
    // Get user session for user-specific data
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('User session not found');
    }

    const donationPayments = await donationPaymentsHandler(
      calendarYearId,
      beneficiaryId,
    );
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
      donationPayments?.map<DonationPaymentType>((dp) => {
        // Need to narrow type to extract specific fields
        const isVoluntary =
          'beneficiaryType' in dp && dp.beneficiaryType !== undefined;
        const isZakat =
          'beneficiaryType' in dp && dp.donationPurpose === 'ZAKAT';

        let beneficiaryId = '';
        let beneficiaryType: BeneficiaryEnumType = BeneficiaryEnumType.BUSINESS;
        let isDeductible = false;

        if ('beneficiaryType' in dp) {
          beneficiaryType = dp.beneficiaryType;
          beneficiaryId =
            (dp.beneficiaryType === 'BUSINESS'
              ? (dp as any).businessId
              : (dp as any).individualId) || '';
          isDeductible = dp.isDeductible;
        } else {
          // Interest Cleansing
          beneficiaryType = BeneficiaryEnumType.BUSINESS;
          beneficiaryId = (dp as any).sourceBusinessId || '';
          isDeductible = dp.isDeductible;
        }

        return {
          id: dp.id,
          amount: dp.amount,
          beneficiaryId,
          beneficiaryType,
          isDeductible,
          datePaid: dp.datePaid,
          transactionId: dp.transactionId ?? undefined,
          donationPurpose: dp.donationPurpose,
        };
      }) || [];

    return (
      <DonationPaymentStateProvider data={data}>
        <DonationTableClient
          individualsOptions={individualsOptions}
          businessesOptions={businessesOptions}
          addRow={addRow as any}
          editRow={editRow}
          deleteRow={deleteRow}
          calendarYearId={calendarYearId}
          dateFrom={dateFrom}
          dateTo={dateTo}
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
