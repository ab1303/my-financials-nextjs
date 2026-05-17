'use client';

import { Disclosure } from '@headlessui/react';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';

import CalendarTableClient from './CalendarTableClient';
import type { CalendarYearType, YearRangeGroup } from './_types';

type PastCalendarYearsProps = {
  groups: YearRangeGroup[];
  onEdit: (record: CalendarYearType) => void;
  onDelete: (record: CalendarYearType) => void;
  onLock: (record: CalendarYearType) => void;
  onUnlock: (record: CalendarYearType) => void;
};

export default function PastCalendarYears({
  groups,
  onEdit,
  onDelete,
  onLock,
  onUnlock,
}: PastCalendarYearsProps) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <div className='mt-12'>
      <div className='font-mono text-muted-foreground mb-4'>Past calendar year(s)</div>
      <div className='space-y-3'>
        {groups.map((group) => (
          <Disclosure key={`${group.fromYear}-${group.toYear}`}>
            {({ open }) => (
              <div className='border border-border rounded-lg overflow-hidden'>
                <Disclosure.Button className='flex justify-between items-center w-full px-6 py-4 bg-muted hover:bg-muted/80 transition-colors'>
                  <div className='flex items-center gap-3'>
                    <ChevronDown
                      className={clsx(
                        'w-5 h-5 text-muted-foreground transition-transform',
                        open ? 'transform rotate-180' : '',
                      )}
                    />
                    <span className='text-base font-semibold text-foreground'>
                      {group.label}
                    </span>
                  </div>
                  <span className='text-sm text-muted-foreground'>
                    {group.entries.length}{' '}
                    {group.entries.length === 1 ? 'entry' : 'entries'}
                  </span>
                </Disclosure.Button>

                <Disclosure.Panel className='px-4 py-4 bg-card'>
                  <CalendarTableClient
                    tableData={group.entries}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onLock={onLock}
                    onUnlock={onUnlock}
                  />
                </Disclosure.Panel>
              </div>
            )}
          </Disclosure>
        ))}
      </div>
    </div>
  );
}
