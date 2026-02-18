'use client';

import { useId, useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { SingleValue } from 'react-select';
import Select from 'react-select';
import { Disclosure } from '@headlessui/react';
import { FiChevronDown, FiPlus } from 'react-icons/fi';
import clsx from 'clsx';
import { NumericFormat } from 'react-number-format';

import { trpc } from '@/server/trpc/client';
import type { CalendarYearType, OptionType } from '@/types';
import type {
  BankTotalSummary,
  AccountBalance,
  SnapshotTotals,
} from '@/types/bank-asset.types';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components';
import NewSnapshotModal from './NewSnapshotModal';

type CalendarType = 'FISCAL' | 'ANNUAL' | 'ZAKAT';

type InitialDataType = {
  calendarYears: Array<CalendarYearType>;
  selectedType: CalendarType;
  selectedCalendarYearId: string;
};

type Props = {
  initialData: InitialDataType;
};

export default function BankAssetsClient({ initialData }: Props) {
  const id = useId();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedType, setSelectedType] = useState<CalendarType>(
    initialData.selectedType,
  );

  // Memoize year options to prevent unnecessary re-renders
  const yearOptions: OptionType[] = useMemo(
    () =>
      initialData.calendarYears.map((cy) => ({
        id: cy.id,
        label: cy.description,
      })),
    [initialData.calendarYears],
  );

  // Initialize selectedYear from server-provided default
  const [selectedYear, setSelectedYear] = useState<SingleValue<OptionType>>(
    () => {
      if (initialData.selectedCalendarYearId && yearOptions.length > 0) {
        return (
          yearOptions.find(
            (opt) => opt.id === initialData.selectedCalendarYearId,
          ) || null
        );
      }
      return null;
    },
  );

  const [isModalOpen, setIsModalOpen] = useState(false);

  // Update selectedYear when initialData changes (e.g., type switch)
  useEffect(() => {
    if (initialData.selectedCalendarYearId && yearOptions.length > 0) {
      const selected = yearOptions.find(
        (opt) => opt.id === initialData.selectedCalendarYearId,
      );
      setSelectedYear(selected || null);
    } else if (yearOptions.length === 0) {
      setSelectedYear(null);
    }
  }, [initialData.selectedCalendarYearId, yearOptions]);

  // Get most recent snapshot for selected calendar year
  const { data: snapshot, isLoading } =
    trpc.bankAsset.getMostRecentSnapshot.useQuery(
      {
        calendarYearId: selectedYear?.id || '',
      },
      {
        enabled: !!selectedYear?.id,
      },
    );

  // Get totals if snapshot exists
  const { data: totals } = trpc.bankAsset.getSnapshotTotals.useQuery(
    {
      snapshotId: snapshot?.id || '',
    },
    {
      enabled: !!snapshot?.id,
    },
  ) as { data?: SnapshotTotals };

  const handleTypeChange = (type: CalendarType) => {
    setSelectedType(type);
    setSelectedYear(null); // Clear selection when type changes
    const params = new URLSearchParams(searchParams?.toString());
    params.set('type', type);
    params.delete('yearId'); // Reset year when type changes
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleYearChange = (selected: SingleValue<OptionType>) => {
    setSelectedYear(selected);
    if (selected) {
      const params = new URLSearchParams(searchParams?.toString());
      params.set('yearId', selected.id);
      router.push(`${pathname}?${params.toString()}`);
    }
  };

  return (
    <div className='space-y-6'>
      {/* Calendar Year Selector */}
      <div className='space-y-4'>
        {/* Calendar Type Tabs */}
        <div>
          <Label htmlFor={`${id}-type`}>Calendar Type</Label>
          <div className='flex gap-2 mt-1'>
            {(['FISCAL', 'ANNUAL', 'ZAKAT'] as CalendarType[]).map((type) => (
              <button
                key={type}
                onClick={() => handleTypeChange(type)}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  selectedType === type
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Year Dropdown */}
        <div>
          <Label htmlFor={`${id}-year`}>Calendar Year</Label>
          <Select
            id={`${id}-year`}
            instanceId={id}
            value={selectedYear}
            onChange={handleYearChange}
            options={yearOptions}
            getOptionValue={(option) => option.id}
            placeholder='Select year...'
            className='mt-1'
            isClearable
          />
        </div>
      </div>

      {/* Snapshot Date Display */}
      {snapshot && (
        <div className='text-gray-600 font-medium'>
          Snapshot as of:{' '}
          {new Date(snapshot.snapshotDate).toLocaleDateString('en-AU', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </div>
      )}

      {/* Grand Total Card */}
      {totals && (
        <div className='bg-teal-50 border-2 border-teal-200 rounded-lg p-6'>
          <div className='text-sm font-medium text-teal-700 uppercase tracking-wide'>
            Total Cash Position
          </div>
          <div className='mt-2 text-3xl font-bold text-teal-900'>
            <NumericFormat
              value={Number(totals.grandTotal)}
              displayType='text'
              thousandSeparator=','
              prefix='$'
              decimalScale={2}
              fixedDecimalScale
            />
          </div>
        </div>
      )}

      {/* Bank Accordions */}
      {!selectedYear ? (
        <div className='text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300'>
          <p className='text-gray-600 mb-2'>
            {yearOptions.length === 0
              ? `No ${selectedType} calendar years available.`
              : 'Please select a calendar year to view bank assets.'}
          </p>
        </div>
      ) : isLoading ? (
        <div className='text-center py-8 text-gray-500'>
          Loading bank assets...
        </div>
      ) : !totals || (totals && totals.banks.length === 0) ? (
        <div className='text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300'>
          <p className='text-gray-600 mb-4'>
            No snapshot recorded for this period.
          </p>
          <Button variant='primary' onClick={() => setIsModalOpen(true)}>
            <FiPlus className='mr-2' />
            New Snapshot
          </Button>
        </div>
      ) : totals ? (
        <div className='space-y-4'>
          {(totals as SnapshotTotals).banks.map((bank: BankTotalSummary) => (
            <Disclosure key={bank.bankId}>
              {({ open }) => (
                <div className='border border-gray-200 rounded-lg overflow-hidden'>
                  <Disclosure.Button className='flex justify-between items-center w-full px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors'>
                    <div className='flex items-center gap-4'>
                      <FiChevronDown
                        className={clsx(
                          'w-5 h-5 text-gray-500 transition-transform',
                          open ? 'transform rotate-180' : '',
                        )}
                      />
                      <span className='text-lg font-semibold text-gray-900'>
                        {bank.bankName}
                      </span>
                    </div>
                    <div className='text-lg font-bold text-gray-900'>
                      <NumericFormat
                        value={Number(bank.total)}
                        displayType='text'
                        thousandSeparator=','
                        prefix='$'
                        decimalScale={2}
                        fixedDecimalScale
                      />
                    </div>
                  </Disclosure.Button>

                  <Disclosure.Panel className='px-6 py-4 bg-white'>
                    <div className='overflow-x-auto'>
                      <table className='min-w-full divide-y divide-gray-200'>
                        <thead className='bg-gray-50'>
                          <tr>
                            <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                              Account Name
                            </th>
                            <th className='px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
                              Balance
                            </th>
                            <th className='px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className='bg-white divide-y divide-gray-200'>
                          {bank.accounts.map((account: AccountBalance) => (
                            <tr key={account.accountId}>
                              <td className='px-4 py-3 text-sm text-gray-900'>
                                {account.accountName}
                              </td>
                              <td className='px-4 py-3 text-sm text-right font-mono text-gray-900'>
                                <NumericFormat
                                  value={Number(account.balance)}
                                  displayType='text'
                                  thousandSeparator=','
                                  prefix='$'
                                  decimalScale={2}
                                  fixedDecimalScale
                                />
                              </td>
                              <td className='px-4 py-3 text-sm text-right'>
                                {/* Actions will be added in Phase 4 */}
                                <span className='text-gray-400 text-xs'>
                                  Edit/Delete
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Disclosure.Panel>
                </div>
              )}
            </Disclosure>
          ))}
        </div>
      ) : null}

      {/* New Snapshot Button (bottom) */}
      {totals && (totals as SnapshotTotals).banks.length > 0 && (
        <div className='flex justify-center pt-4'>
          <Button variant='primary' onClick={() => setIsModalOpen(true)}>
            <FiPlus className='mr-2' />
            New Snapshot
          </Button>
        </div>
      )}

      {/* New Snapshot Modal */}
      <NewSnapshotModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        mostRecentSnapshot={snapshot}
        onSuccess={() => {
          setIsModalOpen(false);
          // Trigger refetch of snapshot data
          window.location.reload();
        }}
      />
    </div>
  );
}
