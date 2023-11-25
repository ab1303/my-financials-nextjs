import { zakatPaymentsHandler } from '@/server/controllers/zakat.controller';
import { ZakatPaymentStateProvider } from './StateProvider';
import ZakatTableClient from './ZakatTableClient';

import type { ZakatPaymentType } from './_types';

export type ZakatTableServerProps = {
  calendarYearId: string;
};

export default async function ZakatPaymentsTableServer({
  calendarYearId,
}: ZakatTableServerProps) {
  const zakatPayments = await zakatPaymentsHandler(calendarYearId);

  const data =
    zakatPayments?.map<ZakatPaymentType>((zp) => ({
      id: zp.id,
      amount: zp.amount,
      beneficiaryId: zp.businessId,
      beneficiaryType: zp.beneficiaryType,
      datePaid: zp.datePaid,
    })) || [];
  return (
    <ZakatPaymentStateProvider data={data}>
      <ZakatTableClient />
    </ZakatPaymentStateProvider>
  );
}
