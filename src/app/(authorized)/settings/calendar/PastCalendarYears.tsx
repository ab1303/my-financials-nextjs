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
};

export default function PastCalendarYears({
  groups,
  onEdit,
  onDelete,
}: PastCalendarYearsProps) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <div className='mt-12'>
      <div className='font-mono text-gray-500 mb-4'>Past calendar year(s)</div>
      <div className='space-y-3'>
        {groups.map((group) => (
          <Disclosure key={`${group.fromYear}-${group.toYear}`}>
            {({ open }) => (
              <div className='border border-gray-200 rounded-lg overflow-hidden'>
                <Disclosure.Button className='flex justify-between items-center w-full px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors'>
                  <div className='flex items-center gap-3'>
                    <FiChevronDown
                      className={clsx(
                        'w-5 h-5 text-gray-500 transition-transform',
                        open ? 'transform rotate-180' : '',
                      )}
                    />
                    <span className='text-base font-semibold text-gray-900'>
                      {group.label}
                    </span>
                  </div>
                  <span className='text-sm text-gray-500'>
                    {group.entries.length}{' '}
                    {group.entries.length === 1 ? 'entry' : 'entries'}
                  </span>
                </Disclosure.Button>

                <Disclosure.Panel className='px-4 py-4 bg-white'>
                  <CalendarTableClient
                    tableData={group.entries}
                    onEdit={onEdit}
                    onDelete={onDelete}
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
