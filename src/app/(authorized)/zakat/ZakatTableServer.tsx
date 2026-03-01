import { zakatPaymentsHandler } from '@/server/controllers/zakat.controller';
import { ZakatPaymentStateProvider } from './StateProvider';
import ZakatTableClient from './ZakatTableClient';
import { allIndividualDetailsHandler } from '@/server/controllers/individual.controller';
import { allBusinessDetailsHandler } from '@/server/controllers/business.controller';
import { auth } from '@/server/auth';

import type { ZakatPaymentType } from './_types';
import type { OptionType } from '@/types';
import { addRow, deleteRow, editRow } from './actions';

export type ZakatTableServerProps = {
  calendarYearId: string;
};

export default async function ZakatPaymentsTableServer({
  calendarYearId,
}: ZakatTableServerProps) {
  try {
    // Get user session for user-specific data
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('User session not found');
    }

    const zakatPayments = await zakatPaymentsHandler(calendarYearId);
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
      zakatPayments?.map<ZakatPaymentType>((zp) => ({
        id: zp.id,
        amount: zp.amount,
        beneficiaryId:
          (zp.beneficiaryType === 'BUSINESS'
            ? zp.businessId
            : zp.individualId) || '',
        beneficiaryType: zp.beneficiaryType,
        datePaid: zp.datePaid,
      })) || [];

    return (
      <ZakatPaymentStateProvider data={data}>
        <ZakatTableClient
          individualsOptions={individualsOptions}
          businessesOptions={businessesOptions}
          addRow={addRow}
          editRow={editRow}
          deleteRow={deleteRow}
          calendarYearId={calendarYearId}
        />
      </ZakatPaymentStateProvider>
    );
  } catch (error) {
    console.error('Error loading Zakat table data:', error);
    return (
      <div className='p-4 bg-red-50 border border-red-200 rounded-md'>
        <p className='text-red-800 font-medium'>
          Failed to load Zakat payments table
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
