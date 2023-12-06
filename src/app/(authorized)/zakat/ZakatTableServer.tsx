import { zakatPaymentsHandler } from '@/server/controllers/zakat.controller';
import { ZakatPaymentStateProvider } from './StateProvider';
import ZakatTableClient from './ZakatTableClient';
import { getIndividualsHandler } from '@/server/controllers/individual.controller';

import type { ZakatPaymentType } from './_types';
import type { OptionType } from '@/types';

export type ZakatTableServerProps = {
  calendarYearId: string;
};

export default async function ZakatPaymentsTableServer({
  calendarYearId,
}: ZakatTableServerProps) {
  const zakatPayments = await zakatPaymentsHandler(calendarYearId);
  const individuals = await getIndividualsHandler();

  let individualsOptions: Array<OptionType> = [];
  if (individuals) {
    individualsOptions = individuals.map<OptionType>((i) => ({
      id: i.id,
      label: i.name,
    }));
  }

  const data =
    zakatPayments?.map<ZakatPaymentType>((zp) => ({
      id: zp.id,
      amount: zp.amount,
      beneficiaryId: zp.businessId || '',
      beneficiaryType: zp.beneficiaryType,
      datePaid: zp.datePaid,
    })) || [];
  return (
    <ZakatPaymentStateProvider data={data}>
      <ZakatTableClient individualsOptions={individualsOptions} />
    </ZakatPaymentStateProvider>
  );
}
