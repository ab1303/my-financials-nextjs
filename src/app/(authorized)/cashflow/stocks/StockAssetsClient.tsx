'use client';

import { Fragment, useId, useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { SingleValue } from 'react-select';
import Select from 'react-select';
import { Disclosure, Dialog, Transition } from '@headlessui/react';
import { FiChevronDown, FiPlus, FiTrash2 } from 'react-icons/fi';
import clsx from 'clsx';
import { NumericFormat } from 'react-number-format';
import { toast } from 'react-toastify';

import { trpc } from '@/server/trpc/client';
import type { CalendarYearType, OptionType } from '@/types';
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

export default function StockAssetsClient({ initialData }: Props) {
  const id = useId();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedType] = useState<CalendarType>(initialData.selectedType);

  const [isNewSnapshotModalOpen, setIsNewSnapshotModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    snapshotId: string;
    snapshotDate: string;
  } | null>(null);

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

  // Snapshot selection state
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(
    null,
  );
  const [snapshotOptions, setSnapshotOptions] = useState<OptionType[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] =
    useState<SingleValue<OptionType>>(null);

  // Fetch brokerage accounts
  const { data: brokerageAccounts } =
    trpc.business.getBusinessesByType.useQuery({
      type: 'BROKERAGE',
    });

  // Fetch snapshots for selected year
  const {
    data: snapshots,
    isLoading: isLoadingSnapshots,
    refetch: refetchSnapshots,
  } = trpc.stockAsset.getSnapshots.useQuery(
    {
      calendarYearId: selectedYear?.id,
      calendarType: selectedType,
    },
    {
      enabled: !!selectedYear,
    },
  );

  // Fetch totals for selected snapshot
  const {
    data: totals,
    isLoading: isLoadingTotals,
    refetch: refetchTotals,
  } = trpc.stockAsset.getSnapshotTotals.useQuery(
    {
      snapshotId: selectedSnapshotId || '',
    },
    {
      enabled: !!selectedSnapshotId,
    },
  );

  // Delete snapshot mutation
  const deleteSnapshot = trpc.stockAsset.deleteSnapshot.useMutation({
    onSuccess: () => {
      toast.success('Snapshot deleted successfully');
      setDeleteConfirm(null);
      refetchSnapshots();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete snapshot');
    },
  });

  const isLoading = isLoadingSnapshots || isLoadingTotals;

  // Update snapshot options when snapshots change
  useEffect(() => {
    if (snapshots && snapshots.length > 0) {
      const options = snapshots.map((snapshot: any) => ({
        id: snapshot.id,
        label: new Date(snapshot.snapshotDate).toLocaleDateString('en-AU', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
      }));
      setSnapshotOptions(options);

      // Auto-select first snapshot if not already selected
      if (!selectedSnapshotId && options.length > 0 && options[0]) {
        setSelectedSnapshotId(options[0].id);
        setSelectedSnapshot(options[0]);
      }
    } else {
      setSnapshotOptions([]);
      setSelectedSnapshotId(null);
      setSelectedSnapshot(null);
    }
  }, [snapshots, selectedSnapshotId]);

  // Update URL when year changes
  useEffect(() => {
    if (selectedYear) {
      const newParams = new URLSearchParams(searchParams?.toString() || '');
      newParams.set('yearId', selectedYear.id);
      router.push(`${pathname}?${newParams.toString()}`);
    }
  }, [selectedYear, pathname, router, searchParams]);

  const handleYearChange = (option: SingleValue<OptionType>) => {
    setSelectedYear(option);
  };

  const handleSnapshotChange = (option: SingleValue<OptionType>) => {
    if (option?.id) {
      setSelectedSnapshotId(option.id);
      setSelectedSnapshot(option);
    }
  };

  const handleDeleteSnapshot = async () => {
    if (!deleteConfirm) return;
    await deleteSnapshot.mutateAsync({ snapshotId: deleteConfirm.snapshotId });
  };

  // Get accounts from snapshot
  const accounts = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return [];

    const selectedSnap = snapshots.find((s) => s.id === selectedSnapshotId);
    if (!selectedSnap) return [];

    // Group holdings by account
    const accountMap = new Map();
    selectedSnap.holdings.forEach((holding) => {
      if (!accountMap.has(holding.accountId)) {
        accountMap.set(holding.accountId, {
          accountId: holding.accountId,
          accountName: holding.account.name,
          holdings: [],
        });
      }
      accountMap.get(holding.accountId).holdings.push(holding);
    });

    return Array.from(accountMap.values());
  }, [snapshots, selectedSnapshotId]);

  return (
    <div className='space-y-6'>
      {/* Fiscal Year & Snapshot Selectors */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <div>
          <Label htmlFor={`${id}-year`}>Fiscal Year</Label>
          <Select
            inputId={`${id}-year`}
            options={yearOptions}
            value={selectedYear}
            onChange={handleYearChange}
            getOptionValue={(option) => option.id}
            isDisabled={yearOptions.length === 0}
            className='mt-1'
          />
        </div>

        {snapshotOptions.length > 0 && (
          <div>
            <Label htmlFor={`${id}-snapshot`}>Snapshot Date</Label>
            <Select
              inputId={`${id}-snapshot`}
              options={snapshotOptions}
              value={selectedSnapshot}
              onChange={handleSnapshotChange}
              getOptionValue={(option) => option.id}
              className='mt-1'
            />
          </div>
        )}
      </div>

      {/* Grand Total Summary Cards */}
      {totals && (
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          {totals.currencies.map((currencyTotal) => (
            <div
              key={currencyTotal.currency}
              className={clsx(
                'rounded-lg p-6 border-2',
                currencyTotal.currency === 'AUD'
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-green-50 border-green-200',
              )}
            >
              <div className='text-sm font-medium uppercase tracking-wide mb-2'>
                <span
                  className={
                    currencyTotal.currency === 'AUD'
                      ? 'text-blue-700'
                      : 'text-green-700'
                  }
                >
                  {currencyTotal.currency} Total Value
                </span>
              </div>
              <div
                className={clsx(
                  'text-3xl font-bold mb-4',
                  currencyTotal.currency === 'AUD'
                    ? 'text-blue-900'
                    : 'text-green-900',
                )}
              >
                <NumericFormat
                  value={currencyTotal.totalValue}
                  displayType='text'
                  thousandSeparator=','
                  prefix={currencyTotal.currency === 'AUD' ? '$' : 'US$'}
                  decimalScale={2}
                  fixedDecimalScale
                />
              </div>
              <div className='space-y-2 text-sm'>
                <div className='flex justify-between'>
                  <span className='text-gray-600'>Cost Basis:</span>
                  <span className='font-medium'>
                    <NumericFormat
                      value={currencyTotal.totalCostBasis}
                      displayType='text'
                      thousandSeparator=','
                      prefix={currencyTotal.currency === 'AUD' ? '$' : 'US$'}
                      decimalScale={2}
                      fixedDecimalScale
                    />
                  </span>
                </div>
                <div className='flex justify-between'>
                  <span className='text-gray-600'>Unrealized P/L:</span>
                  <span
                    className={
                      currencyTotal.totalUnrealizedPL >= 0
                        ? 'font-medium text-green-600'
                        : 'font-medium text-red-600'
                    }
                  >
                    <NumericFormat
                      value={currencyTotal.totalUnrealizedPL}
                      displayType='text'
                      thousandSeparator=','
                      prefix={currencyTotal.currency === 'AUD' ? '$' : 'US$'}
                      decimalScale={2}
                      fixedDecimalScale
                    />
                  </span>
                </div>
                {currencyTotal.totalRealizedPL !== 0 && (
                  <div className='flex justify-between'>
                    <span className='text-gray-600'>Realized P/L:</span>
                    <span
                      className={
                        currencyTotal.totalRealizedPL >= 0
                          ? 'font-medium text-green-600'
                          : 'font-medium text-red-600'
                      }
                    >
                      <NumericFormat
                        value={currencyTotal.totalRealizedPL}
                        displayType='text'
                        thousandSeparator=','
                        prefix={currencyTotal.currency === 'AUD' ? '$' : 'US$'}
                        decimalScale={2}
                        fixedDecimalScale
                      />
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stock Holdings Accordions */}
      <div>
        <div className='flex justify-between items-center mb-4'>
          <h2 className='text-lg font-semibold text-gray-900'>
            Stock Holdings
          </h2>
          <div className='flex gap-2'>
            <Button
              variant='primary'
              onClick={() => setIsNewSnapshotModalOpen(true)}
            >
              <FiPlus className='mr-2' />
              New Snapshot
            </Button>
            {selectedSnapshotId && (
              <Button
                variant='secondary'
                className='text-red-600 hover:text-red-700 border-red-300'
                onClick={() => {
                  if (selectedSnapshot) {
                    setDeleteConfirm({
                      snapshotId: selectedSnapshotId,
                      snapshotDate: selectedSnapshot.label,
                    });
                  }
                }}
              >
                <FiTrash2 className='mr-2' />
                Delete
              </Button>
            )}
          </div>
        </div>

        {!selectedYear ? (
          <div className='text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300'>
            <p className='text-gray-600'>
              {yearOptions.length === 0
                ? `No ${selectedType} calendar years available.`
                : 'Please select a calendar year to view stock assets.'}
            </p>
          </div>
        ) : isLoading ? (
          <div className='text-center py-8 text-gray-500'>
            Loading stock assets...
          </div>
        ) : !snapshots || snapshots.length === 0 ? (
          <div className='text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300'>
            <p className='text-gray-700 mb-4 font-medium'>
              No stock snapshots recorded.
            </p>
            <p className='text-sm text-gray-600 mb-6'>
              Take your first snapshot to start tracking your stock portfolio.
            </p>
            <Button
              variant='primary'
              onClick={() => setIsNewSnapshotModalOpen(true)}
            >
              <FiPlus className='mr-2' />
              New Snapshot
            </Button>
          </div>
        ) : accounts.length === 0 ? (
          <div className='text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300'>
            <p className='text-gray-700 mb-4 font-medium'>
              You need to add brokerage accounts first.
            </p>
            <p className='text-sm text-gray-600 mb-6'>
              Configure your brokerage accounts in Settings before tracking
              stock assets.
            </p>
            <a
              href='/settings/business'
              className='inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium'
            >
              Go to Settings → Business
            </a>
          </div>
        ) : (
          <div className='space-y-4'>
            {accounts.map((account) => (
              <Disclosure key={account.accountId}>
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
                          {account.accountName}
                        </span>
                      </div>
                    </Disclosure.Button>

                    <Disclosure.Panel className='px-6 py-4 bg-white'>
                      <div className='overflow-x-auto'>
                        <table className='min-w-full divide-y divide-gray-200'>
                          <thead className='bg-gray-50'>
                            <tr>
                              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                Ticker
                              </th>
                              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                Company
                              </th>
                              <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                Quantity
                              </th>
                              <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                Buy Price
                              </th>
                              <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                Current Price
                              </th>
                              <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                Market Value
                              </th>
                              <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                Unrealized P/L
                              </th>
                            </tr>
                          </thead>
                          <tbody className='bg-white divide-y divide-gray-200'>
                            {account.holdings.map((holding: any) => {
                              const costBasis =
                                Number(holding.buyPrice) *
                                Number(holding.quantity);
                              const marketValue =
                                Number(holding.currentPrice) *
                                Number(holding.quantity);
                              const unrealizedPL = marketValue - costBasis;

                              return (
                                <tr
                                  key={holding.id}
                                  className='hover:bg-gray-50'
                                >
                                  <td className='px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900'>
                                    {holding.ticker}
                                  </td>
                                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-600'>
                                    {holding.companyName}
                                  </td>
                                  <td className='px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900'>
                                    {Number(holding.quantity).toFixed(6)}
                                  </td>
                                  <td className='px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600'>
                                    <NumericFormat
                                      value={Number(holding.buyPrice)}
                                      displayType='text'
                                      thousandSeparator=','
                                      prefix={
                                        holding.currency === 'AUD' ? '$' : 'US$'
                                      }
                                      decimalScale={2}
                                      fixedDecimalScale
                                    />
                                  </td>
                                  <td className='px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600'>
                                    <NumericFormat
                                      value={Number(holding.currentPrice)}
                                      displayType='text'
                                      thousandSeparator=','
                                      prefix={
                                        holding.currency === 'AUD' ? '$' : 'US$'
                                      }
                                      decimalScale={2}
                                      fixedDecimalScale
                                    />
                                  </td>
                                  <td className='px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900'>
                                    <NumericFormat
                                      value={marketValue}
                                      displayType='text'
                                      thousandSeparator=','
                                      prefix={
                                        holding.currency === 'AUD' ? '$' : 'US$'
                                      }
                                      decimalScale={2}
                                      fixedDecimalScale
                                    />
                                  </td>
                                  <td
                                    className={clsx(
                                      'px-6 py-4 whitespace-nowrap text-sm text-right font-semibold',
                                      unrealizedPL >= 0
                                        ? 'text-green-600'
                                        : 'text-red-600',
                                    )}
                                  >
                                    <NumericFormat
                                      value={unrealizedPL}
                                      displayType='text'
                                      thousandSeparator=','
                                      prefix={
                                        holding.currency === 'AUD' ? '$' : 'US$'
                                      }
                                      decimalScale={2}
                                      fixedDecimalScale
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </Disclosure.Panel>
                  </div>
                )}
              </Disclosure>
            ))}
          </div>
        )}
      </div>

      {/* New Snapshot Modal */}
      <NewSnapshotModal
        isOpen={isNewSnapshotModalOpen}
        onClose={() => setIsNewSnapshotModalOpen(false)}
        onSuccess={() => {
          setIsNewSnapshotModalOpen(false);
          refetchSnapshots();
        }}
        brokerageAccounts={brokerageAccounts || []}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <Transition show={true} as={Fragment}>
          <Dialog
            as='div'
            className='relative z-50'
            onClose={() => setDeleteConfirm(null)}
          >
            <Transition.Child
              as={Fragment}
              enter='ease-out duration-300'
              enterFrom='opacity-0'
              enterTo='opacity-100'
              leave='ease-in duration-200'
              leaveFrom='opacity-100'
              leaveTo='opacity-0'
            >
              <div className='fixed inset-0 bg-black bg-opacity-25' />
            </Transition.Child>

            <div className='fixed inset-0 overflow-y-auto'>
              <div className='flex min-h-full items-center justify-center p-4'>
                <Transition.Child
                  as={Fragment}
                  enter='ease-out duration-300'
                  enterFrom='opacity-0 scale-95'
                  enterTo='opacity-100 scale-100'
                  leave='ease-in duration-200'
                  leaveFrom='opacity-100 scale-100'
                  leaveTo='opacity-0 scale-95'
                >
                  <Dialog.Panel className='w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl transition-all'>
                    <Dialog.Title
                      as='h3'
                      className='text-lg font-medium leading-6 text-red-600'
                    >
                      Delete Snapshot
                    </Dialog.Title>
                    <div className='mt-2'>
                      <p className='text-sm text-gray-600'>
                        Are you sure you want to delete the snapshot from{' '}
                        <span className='font-medium'>
                          {deleteConfirm.snapshotDate}
                        </span>
                        ?
                      </p>
                      <p className='text-sm text-gray-500 mt-2'>
                        This action cannot be undone. All holdings in this
                        snapshot will be deleted.
                      </p>
                    </div>

                    <div className='mt-4 flex gap-3 justify-end'>
                      <Button
                        variant='secondary'
                        onClick={() => setDeleteConfirm(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant='secondary'
                        className='text-red-600 hover:text-red-700'
                        onClick={handleDeleteSnapshot}
                        disabled={deleteSnapshot.isPending}
                      >
                        {deleteSnapshot.isPending ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>
      )}
    </div>
  );
}
