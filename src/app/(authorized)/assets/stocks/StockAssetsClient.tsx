'use client';

import { Fragment, useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { SingleValue } from 'react-select';
import { Disclosure, Dialog, Transition } from '@headlessui/react';
import { ChevronDown, Plus, Trash2, Pencil } from 'lucide-react';
import clsx from 'clsx';
import { NumericFormat } from 'react-number-format';
import { toast } from 'sonner';

import { trpc } from '@/server/trpc/client';
import type { CalendarYearType, OptionType } from '@/types';
import { Button } from '@/components';
import NewSnapshotModal from './NewSnapshotModal';
import HoldingFormModal from './HoldingFormModal';
import SummaryCards from './SummaryCards';
import { YearSnapshotSelectors } from './YearSnapshotSelectors';
import {
  calculateHoldingMetrics,
  formatCurrency,
  formatQuantity,
  formatPrice,
  formatPercentage,
  formatHoldingPeriod,
  getPLColorClass,
  getPLBgColorClass,
  getTermStatusColorClass,
  getTermStatusLabel,
} from '@/utils/stock-asset-calculations';
import type { StockHoldingWithAccount } from '@/types/stock-asset.types';
import AIUsageCard from '@/components/AIUsageCard';

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedType] = useState<CalendarType>(initialData.selectedType);

  const [isNewSnapshotModalOpen, setIsNewSnapshotModalOpen] = useState(false);
  const [isHoldingFormModalOpen, setIsHoldingFormModalOpen] = useState(false);
  const [editingHolding, setEditingHolding] =
    useState<StockHoldingWithAccount | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    snapshotId: string;
    snapshotDate: string;
  } | null>(null);
  const [deleteHoldingConfirm, setDeleteHoldingConfirm] = useState<{
    holdingId: string;
    ticker: string;
    snapshotId: string;
  } | null>(null);
  const [addingToAccountId, setAddingToAccountId] = useState<string | null>(null);

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

  // Fetch brokerage accounts and institutions
  const { data: brokerageAccounts = [], refetch: refetchBrokerageAccounts } =
    trpc.stockAsset.getBrokerageAccounts.useQuery();
  const { data: brokerageInstitutions = [], refetch: refetchBrokerageInstitutions } =
    trpc.business.getBrokeragesWithAccounts.useQuery();

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

  // Update holding mutation
  const updateHolding = trpc.stockAsset.updateHolding.useMutation({
    onSuccess: () => {
      toast.success('Holding updated successfully');
      setEditingHolding(null);
      setIsHoldingFormModalOpen(false);
      refetchTotals();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update holding');
    },
  });

  // Delete holding mutation
  const deleteHolding = trpc.stockAsset.deleteHolding.useMutation({
    onSuccess: () => {
      toast.success('Holding deleted successfully');
      setDeleteHoldingConfirm(null);
      refetchTotals();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete holding');
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

  // Update URL when year changes — only when yearId actually differs to prevent infinite re-render loop
  useEffect(() => {
    if (selectedYear) {
      const currentYearId = searchParams?.get('yearId');
      if (currentYearId !== selectedYear.id) {
        const newParams = new URLSearchParams(searchParams?.toString() || '');
        newParams.set('yearId', selectedYear.id);
        router.replace(`${pathname}?${newParams.toString()}`);
      }
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

  // Compute date range for AI usage card from selected calendar year
  const selectedCalendarYearFull = useMemo(() => {
    if (!selectedYear?.id) return null;
    return (
      initialData.calendarYears.find((cy) => cy.id === selectedYear.id) ?? null
    );
  }, [selectedYear, initialData.calendarYears]);

  const aiUsageDateRange = useMemo(() => {
    if (!selectedCalendarYearFull) return null;
    return {
      dateFrom: new Date(
        selectedCalendarYearFull.fromYear,
        selectedCalendarYearFull.fromMonth - 1,
        1,
      ),
      dateTo: new Date(
        selectedCalendarYearFull.toYear,
        selectedCalendarYearFull.toMonth,
        0,
        23,
        59,
        59,
      ),
      label: selectedCalendarYearFull.description,
    };
  }, [selectedCalendarYearFull]);

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
          accountName: `${holding.account.institution.name} — ${holding.account.name}`,
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
      <YearSnapshotSelectors
        yearOptions={yearOptions}
        selectedYear={selectedYear}
        onYearChange={handleYearChange}
        snapshotOptions={snapshotOptions}
        selectedSnapshot={selectedSnapshot}
        onSnapshotChange={handleSnapshotChange}
      />

      {/* AI Usage Card */}
      {aiUsageDateRange && (
        <AIUsageCard
          importType='STOCK'
          dateFrom={aiUsageDateRange.dateFrom}
          dateTo={aiUsageDateRange.dateTo}
          dateLabel={aiUsageDateRange.label}
        />
      )}

      {/* Grand Total Summary Cards */}
      {totals && totals.currencies && (
        <SummaryCards currencyTotals={totals.currencies} />
      )}

      {/* Stock Holdings Accordions */}
      <div>
        <div className='flex justify-between items-center mb-4'>
          <h2 className='text-lg font-semibold text-foreground'>
            Stock Holdings
          </h2>
          <div className='flex gap-2'>
            <Button
              variant='primary'
              onClick={() => setIsNewSnapshotModalOpen(true)}
            >
              <Plus className='mr-2 w-4 h-4' />
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
                <Trash2 className='mr-2' />
                Delete
              </Button>
            )}
          </div>
        </div>

        {!selectedYear ? (
          <div className='text-center py-12 bg-muted rounded-lg border-2 border-dashed border-input'>
            <p className='text-muted-foreground'>
              {yearOptions.length === 0
                ? `No ${selectedType} calendar years available.`
                : 'Please select a calendar year to view stock assets.'}
            </p>
          </div>
        ) : isLoading ? (
          <div className='text-center py-8 text-muted-foreground'>
            Loading stock assets...
          </div>
        ) : !snapshots || snapshots.length === 0 ? (
          <div className='text-center py-12 bg-muted rounded-lg border-2 border-dashed border-input'>
            <p className='text-foreground mb-4 font-medium'>
              No stock snapshots recorded.
            </p>
            <p className='text-sm text-muted-foreground mb-6'>
              Take your first snapshot to start tracking your stock portfolio.
            </p>
            <Button
              variant='primary'
              onClick={() => setIsNewSnapshotModalOpen(true)}
            >
              <Plus className='mr-2 w-4 h-4' />
              New Snapshot
            </Button>
          </div>
        ) : accounts.length === 0 ? (
          <div className='text-center py-12 bg-muted rounded-lg border-2 border-dashed border-input'>
            <p className='text-foreground mb-4 font-medium'>
              You need to add brokerage accounts first.
            </p>
            <p className='text-sm text-muted-foreground mb-6'>
              Configure your brokerage accounts in Settings before tracking
              stock assets.
            </p>
            <a
              href='/settings/business'
              className='inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium'
            >
              Go to Settings â†’ Business
            </a>
          </div>
        ) : (
          <div className='space-y-4'>
            {accounts.map((account) => (
              <Disclosure key={account.accountId}>
                {({ open }) => (
                  <div className='border border-border rounded-lg overflow-hidden'>
                    <Disclosure.Button className='flex justify-between items-center w-full px-6 py-4 bg-muted hover:bg-muted/50 transition-colors'>
                      <div className='flex items-center gap-4'>
                        <ChevronDown
                          className={clsx(
                            'w-5 h-5 text-muted-foreground transition-transform',
                            open ? 'transform rotate-180' : '',
                          )}
                        />
                        <span className='text-lg font-semibold text-foreground'>
                          {account.accountName}
                        </span>
                      </div>
                    </Disclosure.Button>

                    <Disclosure.Panel className='px-6 py-4 bg-card'>
                      <div className='overflow-x-auto'>
                        <table className='min-w-full divide-y divide-border'>
                          <thead className='bg-muted'>
                            <tr>
                              <th className='px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                                Stock
                              </th>
                              <th className='px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                                Qty
                              </th>
                              <th className='px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                                Buy Price
                              </th>
                              <th className='px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                                Buy Date
                              </th>
                              <th className='px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                                Curr Price
                              </th>
                              <th className='px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                                Value
                              </th>
                              <th className='px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                                P/L
                              </th>
                              <th className='px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                                P/L %
                              </th>
                              <th className='px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                                Holding
                              </th>
                              <th className='px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                                Term
                              </th>
                              <th className='px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                                CGT
                              </th>
                              <th className='px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className='bg-card divide-y divide-border'>
                            {account.holdings.map((holding: any) => {
                              const metrics = calculateHoldingMetrics(
                                holding,
                                new Date(
                                  snapshots?.find(
                                    (s) => s.id === selectedSnapshotId,
                                  )?.snapshotDate || new Date(),
                                ),
                              );

                              return (
                                <tr
                                  key={holding.id}
                                  className={clsx(
                                    'hover:bg-muted/50',
                                    metrics.isSold && 'opacity-75',
                                  )}
                                >
                                  {/* Stock: ticker + company */}
                                  <td className='px-6 py-4 text-sm'>
                                    <div className='font-semibold text-foreground'>
                                      {holding.ticker}
                                      {metrics.isSold && (
                                        <span className='ml-2 inline-block px-2 py-1 text-xs font-semibold bg-muted text-foreground rounded'>
                                          SOLD
                                        </span>
                                      )}
                                    </div>
                                    <div className='text-xs text-muted-foreground'>
                                      {holding.companyName}
                                    </div>
                                  </td>

                                  {/* Quantity */}
                                  <td className='px-6 py-4 whitespace-nowrap text-sm text-right text-foreground'>
                                    {formatQuantity(metrics.remainingQuantity)}
                                  </td>

                                  {/* Buy Price */}
                                  <td className='px-6 py-4 whitespace-nowrap text-sm text-right text-muted-foreground'>
                                    {formatPrice(
                                      Number(holding.buyPrice),
                                      holding.currency,
                                    )}
                                  </td>

                                  {/* Buy Date */}
                                  <td className='px-6 py-4 whitespace-nowrap text-sm text-right text-muted-foreground'>
                                    {new Date(
                                      holding.buyDate,
                                    ).toLocaleDateString('en-AU', {
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                  </td>

                                  {/* Current Price */}
                                  <td className='px-6 py-4 whitespace-nowrap text-sm text-right text-muted-foreground'>
                                    {formatPrice(
                                      Number(holding.currentPrice),
                                      holding.currency,
                                    )}
                                  </td>

                                  {/* Market Value */}
                                  <td className='px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-foreground'>
                                    {formatCurrency(
                                      metrics.marketValue,
                                      holding.currency,
                                    )}
                                  </td>

                                  {/* Unrealized P/L */}
                                  <td
                                    className={clsx(
                                      'px-6 py-4 whitespace-nowrap text-sm text-right font-semibold',
                                      getPLColorClass(metrics.unrealizedPL),
                                    )}
                                  >
                                    {formatCurrency(
                                      metrics.unrealizedPL,
                                      holding.currency,
                                    )}
                                  </td>

                                  {/* P/L % */}
                                  <td
                                    className={clsx(
                                      'px-6 py-4 whitespace-nowrap text-sm text-right font-semibold',
                                      getPLColorClass(
                                        metrics.unrealizedPLPercent,
                                      ),
                                    )}
                                  >
                                    {formatPercentage(
                                      metrics.unrealizedPLPercent,
                                    )}
                                  </td>

                                  {/* Holding Period */}
                                  <td className='px-6 py-4 whitespace-nowrap text-sm text-center text-muted-foreground'>
                                    {formatHoldingPeriod(
                                      metrics.holdingPeriodMonths,
                                    )}
                                  </td>

                                  {/* Term Status */}
                                  <td className='px-6 py-4 whitespace-nowrap text-sm text-center'>
                                    <span
                                      className={clsx(
                                        'inline-block px-2 py-1 text-xs font-semibold rounded',
                                        getTermStatusColorClass(
                                          metrics.termStatus,
                                        ),
                                      )}
                                    >
                                      {getTermStatusLabel(metrics.termStatus)}
                                    </span>
                                  </td>

                                  {/* CGT Eligibility */}
                                  <td className='px-6 py-4 whitespace-nowrap text-sm text-center'>
                                    {metrics.isSold ? (
                                      metrics.isCGTEligible ? (
                                        <span className='text-green-600 font-semibold'>
                                          âœ“
                                        </span>
                                      ) : (
                                        <span className='text-red-600'>
                                          âœ—
                                        </span>
                                      )
                                    ) : (
                                      <span className='text-muted-foreground text-xs'>
                                        N/A
                                      </span>
                                    )}
                                  </td>

                                  {/* Actions */}
                                  <td className='px-6 py-4 whitespace-nowrap text-sm text-center space-x-2'>
                                    <button
                                      onClick={() => {
                                        setEditingHolding(holding);
                                        setIsHoldingFormModalOpen(true);
                                      }}
                                      className='text-indigo-600 hover:text-indigo-700 inline-block'
                                      title='Edit holding'
                                    >
                                      <Pencil size={16} />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setDeleteHoldingConfirm({
                                          holdingId: holding.id,
                                          ticker: holding.ticker,
                                          snapshotId: selectedSnapshotId || '',
                                        });
                                      }}
                                      className='text-red-600 hover:text-red-700 inline-block'
                                      title='Delete holding'
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className='mt-4 flex justify-end'>
                        <Button
                          variant='secondary'
                          onClick={() => {
                            setEditingHolding(null);
                            setAddingToAccountId(account.accountId);
                            setIsHoldingFormModalOpen(true);
                          }}
                        >
                          <Plus className='mr-2 w-4 h-4' />
                          Add Holding
                        </Button>
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
          refetchBrokerageAccounts();
          refetchBrokerageInstitutions();
        }}
        brokerageAccounts={brokerageAccounts}
        brokerageInstitutions={brokerageInstitutions}
      />

      {/* Holding Form Modal (Add/Edit) */}
      <HoldingFormModal
        isOpen={isHoldingFormModalOpen}
        onClose={() => {
          setAddingToAccountId(null);
          setIsHoldingFormModalOpen(false);
          setEditingHolding(null);
        }}
        onSuccess={() => {
          setAddingToAccountId(null);
          setIsHoldingFormModalOpen(false);
          setEditingHolding(null);
          refetchBrokerageAccounts();
          refetchBrokerageInstitutions();
          refetchTotals();
        }}
        brokerageAccounts={brokerageAccounts}
        brokerageInstitutions={brokerageInstitutions}
        snapshotId={selectedSnapshotId || undefined}
        editingHolding={editingHolding}
        defaultAccountId={addingToAccountId || undefined}
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
                  <Dialog.Panel className='w-full max-w-md transform overflow-hidden rounded-lg bg-card p-6 text-left align-middle shadow-xl transition-all'>
                    <Dialog.Title
                      as='h3'
                      className='text-lg font-medium leading-6 text-red-600'
                    >
                      Delete Snapshot
                    </Dialog.Title>
                    <div className='mt-2'>
                      <p className='text-sm text-muted-foreground'>
                        Are you sure you want to delete the snapshot from{' '}
                        <span className='font-medium'>
                          {deleteConfirm.snapshotDate}
                        </span>
                        ?
                      </p>
                      <p className='text-sm text-muted-foreground mt-2'>
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

      {/* Delete Holding Confirmation Modal */}
      {deleteHoldingConfirm && (
        <Transition show={true} as={Fragment}>
          <Dialog
            as='div'
            className='relative z-50'
            onClose={() => setDeleteHoldingConfirm(null)}
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
                  <Dialog.Panel className='w-full max-w-md transform overflow-hidden rounded-lg bg-card p-6 text-left align-middle shadow-xl transition-all'>
                    <Dialog.Title
                      as='h3'
                      className='text-lg font-medium leading-6 text-red-600'
                    >
                      Delete Holding
                    </Dialog.Title>
                    <div className='mt-2'>
                      <p className='text-sm text-muted-foreground'>
                        Are you sure you want to delete{' '}
                        <span className='font-semibold'>
                          {deleteHoldingConfirm.ticker}
                        </span>
                        ?
                      </p>
                      <p className='text-sm text-muted-foreground mt-2'>
                        This action cannot be undone.
                      </p>
                    </div>

                    <div className='mt-4 flex gap-3 justify-end'>
                      <Button
                        variant='secondary'
                        onClick={() => setDeleteHoldingConfirm(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant='secondary'
                        className='text-red-600 hover:text-red-700'
                        onClick={async () => {
                          await deleteHolding.mutateAsync({
                            holdingId: deleteHoldingConfirm.holdingId,
                          });
                        }}
                        disabled={deleteHolding.isPending}
                      >
                        {deleteHolding.isPending ? 'Deleting...' : 'Delete'}
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
