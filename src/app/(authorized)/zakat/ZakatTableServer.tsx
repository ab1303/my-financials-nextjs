import { ZakatPaymentStateProvider } from './StateProvider';
import ZakatTableClient from './ZakatTableClient';

export type ZakatTableServerProps = {
  calendarYearId: string;
};

export default function ZakatPaymentsTableServer({
  calendarYearId,
}: ZakatTableServerProps) {
  return (
    <ZakatPaymentStateProvider data={[]}>
      <ZakatTableClient calendarYearId={calendarYearId} />;
    </ZakatPaymentStateProvider>
  );
}
