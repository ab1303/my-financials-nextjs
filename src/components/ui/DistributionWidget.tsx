import React from 'react';

export type DistributionItem = {
  name: string;
  total: number;
  percentage: number;
  color: string;
};

type DistributionWidgetProps<T extends DistributionItem> = {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
};

export function DistributionWidget<T extends DistributionItem>({
  items,
  renderItem,
}: DistributionWidgetProps<T>) {
  if (items.length === 0) return null;

  return (
    <div className='mb-4 rounded-lg border border-border bg-card/50 p-3'>
      <div className='flex h-2 w-full overflow-hidden rounded-full bg-muted'>
        {items.map((item) => (
          <div
            key={item.name}
            style={{ width: `${item.percentage}%` }}
            className={item.color}
            title={`${item.name}: ${item.percentage.toFixed(1)}%`}
          />
        ))}
      </div>
      <div className='mt-2 flex flex-wrap gap-3'>
        {items.map((item) => (
          <React.Fragment key={item.name}>
            {renderItem(item)}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
