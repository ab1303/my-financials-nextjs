'use client';

import { NumericFormat } from 'react-number-format';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SourceBreakdown } from '@/server/models/income';

type IncomeSourceChartProps = {
  data: SourceBreakdown[];
  onSourceClick?: (sourceName: string) => void;
};

export function IncomeSourceChart({
  data,
  onSourceClick,
}: IncomeSourceChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='text-sm font-medium'>
            Income by Source
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-muted-foreground py-4 text-center'>
            No income recorded
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-sm font-medium'>Income by Source</CardTitle>
      </CardHeader>
      <CardContent className='space-y-2'>
        {data.map((item) => (
          <div
            key={item.source}
            className={`space-y-1 ${
              onSourceClick ? 'cursor-pointer hover:opacity-80' : ''
            }`}
            onClick={() => onSourceClick?.(item.source)}
          >
            <div className='flex justify-between text-xs'>
              <span className='text-foreground/80 truncate max-w-[60%]'>
                {item.source}
              </span>
              <span className='text-muted-foreground'>
                <NumericFormat
                  value={item.amount}
                  displayType='text'
                  thousandSeparator=','
                  prefix='$'
                  decimalScale={0}
                  fixedDecimalScale
                />{' '}
                ({item.percentage.toFixed(1)}%)
              </span>
            </div>
            <div className='h-1.5 w-full bg-muted rounded-full overflow-hidden'>
              <div
                className='h-full bg-green-400 dark:bg-green-500 rounded-full transition-all'
                style={{ width: `${Math.min(item.percentage, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
