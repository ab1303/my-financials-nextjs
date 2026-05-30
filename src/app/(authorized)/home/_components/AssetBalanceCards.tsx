import { DollarSign, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  latestCashTotal: number;
  latestStockTotal: number;
  latestCashDate: string | null;
  latestStockDate: string | null;
}

/**
 * AssetBalanceCards - Server Component
 * Displays two KPI cards for bank balance and stock portfolio
 * Each card shows the latest balance, formatted in AUD, with "as of" date
 */
export function AssetBalanceCards({
  latestCashTotal,
  latestStockTotal,
  latestCashDate,
  latestStockDate,
}: Props) {
  const formatAUD = (value: number) =>
    new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No data';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-AU', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'No data';
    }
  };

  return (
    <>
      {/* Bank Balance Card */}
      <Card className="dark:border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Wallet className="h-4 w-4 text-blue-500 dark:text-blue-400" aria-hidden="true" />
            Bank Balance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {latestCashTotal === 0 ? (
            <p className="text-sm text-muted-foreground">No data</p>
          ) : (
            <>
              <p className="text-2xl font-bold tabular-nums text-foreground">
                {formatAUD(latestCashTotal)}
              </p>
              <p className="text-xs text-muted-foreground">
                as of {formatDate(latestCashDate)}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Stock Portfolio Card */}
      <Card className="dark:border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <DollarSign className="h-4 w-4 text-green-500 dark:text-green-400" aria-hidden="true" />
            Stock Portfolio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {latestStockTotal === 0 ? (
            <p className="text-sm text-muted-foreground">No data</p>
          ) : (
            <>
              <p className="text-2xl font-bold tabular-nums text-foreground">
                {formatAUD(latestStockTotal)}
              </p>
              <p className="text-xs text-muted-foreground">
                as of {formatDate(latestStockDate)}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
