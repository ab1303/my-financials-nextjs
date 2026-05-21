'use client';

import { Fragment, useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { SingleValue } from 'react-select';
import { Disclosure, Dialog, Transition } from '@headlessui/react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
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
  getPLColorClass,
} from '@/utils/stock-asset-calculations';
import type { StockHoldingWithAccount } from '@/types/stock-asset.types';
import type { CurrencyEnumType } from '@prisma/client';
import AIUsageCard from '@/components/AIUsageCard';
import HoldingsTable from './HoldingsTable';

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
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(null);

  // Grouping toggle state — persisted to localStorage
  const [groupBy, setGroupBy] = useState<'currency' | 'brokerage'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('stockGroupBy') as 'currency' | 'brokerage') ?? 'currency';
    }
    return 'currency';
  });

  const handleGroupByChange = (mode: 'currency' | 'brokerage') => {
    setGroupBy(mode);
    localStorage.setItem('stockGroupBy', mode);
  };

  const handleAddHolding = (accountId: string) => {
    setEditingHolding(null);
    setAddingToAccountId(accountId);
    setIsHoldingFormModalOpen(true);
  };

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
      refetchSnapshots();
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

  // The currently selected snapshot (raw, with full StockHoldingWithAccount[])
  const selectedSnap = useMemo(
    () => snapshots?.find((s) => s.id === selectedSnapshotId) ?? null,
    [snapshots, selectedSnapshotId],
  );

  // Pre-computed snapshot date for calculateHoldingMetrics
  const snapshotDate = useMemo(
    () => (selectedSnap ? new Date(selectedSnap.snapshotDate) : new Date()),
    [selectedSnap],
  );

  // Currency view: [{ currency, totalMarketValue, totalUnrealizedPL, accounts: [...] }]
  const currencyGroups = useMemo(() => {
    if (!selectedSnap) return [];

    const map = new Map<
      CurrencyEnumType,
      Map<string, { accountId: string; accountName: string; holdings: StockHoldingWithAccount[] }>
    >();

    for (const holding of selectedSnap.holdings) {
      const currency = holding.currency;
      const accountId = holding.accountId;
      const accountName = `${holding.account.institution.name} — ${holding.account.name}`;

      if (!map.has(currency)) map.set(currency, new Map());
      const acctMap = map.get(currency)!;
      if (!acctMap.has(accountId)) acctMap.set(accountId, { accountId, accountName, holdings: [] });
      acctMap.get(accountId)!.holdings.push(holding);
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, acctMap]) => {
        const accounts = Array.from(acctMap.values()).map((acct) => {
          const acctTotals = acct.holdings.reduce(
            (acc, h) => {
              const m = calculateHoldingMetrics(h, snapshotDate);
              return {
                totalMarketValue: acc.totalMarketValue + m.marketValue,
                totalUnrealizedPL: acc.totalUnrealizedPL + m.unrealizedPL,
                totalCostBasis: acc.totalCostBasis + m.costBasis,
              };
            },
            { totalMarketValue: 0, totalUnrealizedPL: 0, totalCostBasis: 0 },
          );
          return { ...acct, ...acctTotals };
        });

        const currencyTotals = accounts.reduce(
          (acc, a) => ({
            totalMarketValue: acc.totalMarketValue + a.totalMarketValue,
            totalUnrealizedPL: acc.totalUnrealizedPL + a.totalUnrealizedPL,
            totalCostBasis: acc.totalCostBasis + a.totalCostBasis,
          }),
          { totalMarketValue: 0, totalUnrealizedPL: 0, totalCostBasis: 0 },
        );

        return { currency, accounts, ...currencyTotals };
      });
  }, [selectedSnap, snapshotDate]);

  // Brokerage view: [{ accountId, accountName, currencies: [{ currency, holdings, totals }] }]
  const brokerageGroups = useMemo(() => {
    if (!selectedSnap) return [];

    const map = new Map<
      string,
      { accountId: string; accountName: string; currencies: Map<CurrencyEnumType, StockHoldingWithAccount[]> }
    >();

    for (const holding of selectedSnap.holdings) {
      const accountId = holding.accountId;
      const accountName = `${holding.account.institution.name} — ${holding.account.name}`;
      const currency = holding.currency;

      if (!map.has(accountId)) map.set(accountId, { accountId, accountName, currencies: new Map() });
      const entry = map.get(accountId)!;
      if (!entry.currencies.has(currency)) entry.currencies.set(currency, []);
      entry.currencies.get(currency)!.push(holding);
    }

    return Array.from(map.values()).map((b) => ({
      accountId: b.accountId,
      accountName: b.accountName,
      currencies: Array.from(b.currencies.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([currency, holdings]) => {
          const totals = holdings.reduce(
            (acc, h) => {
              const m = calculateHoldingMetrics(h, snapshotDate);
              return {
                totalMarketValue: acc.totalMarketValue + m.marketValue,
                totalUnrealizedPL: acc.totalUnrealizedPL + m.unrealizedPL,
                totalCostBasis: acc.totalCostBasis + m.costBasis,
              };
            },
            { totalMarketValue: 0, totalUnrealizedPL: 0, totalCostBasis: 0 },
          );
          return { currency, holdings, ...totals };
        }),
    }));
  }, [selectedSnap, snapshotDate]);

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
      {totals && totals.currencyTotals && (
        <SummaryCards
          currencyTotals={totals.currencyTotals}
          usdToAudRate={totals.usdToAudRate ?? null}
          snapshotDate={snapshotDate}
          snapshotId={selectedSnapshotId}
        />
      )}

      {/* Stock Holdings Accordions */}
      <div>
        <div className='flex justify-between items-center mb-4'>
          <h2 className='text-lg font-semibold text-foreground'>
            Stock Holdings
          </h2>
          <div className='flex gap-2 items-center'>
            {currencyGroups.length > 0 && (
              <div className='flex rounded-md border border-border overflow-hidden text-sm'>
                <button
                  onClick={() => handleGroupByChange('currency')}
                  className={clsx(
                    'px-3 py-1.5 font-medium transition-colors',
                    groupBy === 'currency'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card text-muted-foreground hover:bg-muted',
                  )}
                >
                  By Currency
                </button>
                <button
                  onClick={() => handleGroupByChange('brokerage')}
                  className={clsx(
                    'px-3 py-1.5 font-medium transition-colors border-l border-border',
                    groupBy === 'brokerage'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card text-muted-foreground hover:bg-muted',
                  )}
                >
                  By Brokerage
                </button>
              </div>
            )}
            <Button
              variant='primary'
              onClick={() => setIsNewSnapshotModalOpen(true)}
            >
              <Plus className='mr-2 w-4 h-4' />
              New Snapshot
            </Button>
            {selectedSnapshotId && (
              <>
                <Button
                  variant='secondary'
                  onClick={() => setEditingSnapshotId(selectedSnapshotId)}
                >
                  ✏️ Edit
                </Button>
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
              </>
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
        ) : currencyGroups.length === 0 ? (
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
          <div className='space-y-6'>
            {groupBy === 'currency' ? (
              /* ── Currency View: currency sections → brokerage accordions ── */
              currencyGroups.map((currencyGroup) => {
                const flag = currencyGroup.currency === 'AUD' ? '🇦🇺' : '🇺🇸';
                return (
                  <div key={currencyGroup.currency} className='space-y-3'>
                    {/* Currency section header */}
                    <div className='px-2 py-2 border-b-2 border-border'>
                      <div className='flex items-center justify-between'>
                        <h3 className='text-base font-semibold text-foreground'>
                          {flag} {currencyGroup.currency} Holdings
                        </h3>
                        <div className='flex items-center gap-6 text-sm'>
                          <div className='text-right'>
                            <p className='text-xs text-muted-foreground'>Invested</p>
                            <p className='font-medium text-foreground'>
                              {formatCurrency(currencyGroup.totalCostBasis, currencyGroup.currency)}
                            </p>
                          </div>
                          <div className='text-right'>
                            <p className='text-xs text-muted-foreground'>Current</p>
                            <p className='font-medium text-foreground'>
                              {formatCurrency(currencyGroup.totalMarketValue, currencyGroup.currency)}
                            </p>
                          </div>
                          <div className='text-right'>
                            <p className='text-xs text-muted-foreground'>P/L</p>
                            <p className={clsx('font-semibold', getPLColorClass(currencyGroup.totalUnrealizedPL))}>
                              {currencyGroup.totalUnrealizedPL >= 0 ? '+' : ''}
                              {formatCurrency(currencyGroup.totalUnrealizedPL, currencyGroup.currency)}
                            </p>
                          </div>
                        </div>
                      </div>
                      {currencyGroup.currency === 'USD' && totals?.usdToAudRate && (
                        <p className='text-xs text-muted-foreground mt-1 text-right'>
                          ≈ {formatCurrency(currencyGroup.totalMarketValue * totals.usdToAudRate, 'AUD')} AUD
                          <span className='ml-2 opacity-70'>
                            (1 USD = {Number(totals.usdToAudRate).toFixed(4)} AUD)
                          </span>
                        </p>
                      )}
                    </div>

                    {/* Brokerage account accordions within this currency */}
                    {currencyGroup.accounts.map((account) => (
                      <Disclosure key={`${currencyGroup.currency}-${account.accountId}`} defaultOpen>
                        {({ open }) => (
                          <div className='border border-border rounded-lg overflow-hidden'>
                            <Disclosure.Button className='flex justify-between items-center w-full px-6 py-4 bg-muted hover:bg-muted/50 transition-colors'>
                              <div className='flex items-center gap-4'>
                                <ChevronDown
                                  className={clsx(
                                    'w-5 h-5 text-muted-foreground transition-transform',
                                    open && 'rotate-180',
                                  )}
                                />
                                <span className='text-base font-semibold text-foreground'>
                                  {account.accountName}
                                </span>
                              </div>
                              <span className='text-sm text-muted-foreground'>
                                {formatCurrency(account.totalMarketValue, currencyGroup.currency)}
                              </span>
                            </Disclosure.Button>
                            <Disclosure.Panel className='px-6 py-4 bg-card'>
                              <HoldingsTable
                                holdings={account.holdings}
                                snapshotDate={snapshotDate}
                                snapshotId={selectedSnapshotId ?? ''}
                                accountId={account.accountId}
                                onEdit={(holding) => {
                                  setEditingHolding(holding);
                                  setIsHoldingFormModalOpen(true);
                                }}
                                onDeleteConfirm={(holdingId, ticker, sid) =>
                                  setDeleteHoldingConfirm({ holdingId, ticker, snapshotId: sid })
                                }
                                onAddHolding={handleAddHolding}
                              />
                            </Disclosure.Panel>
                          </div>
                        )}
                      </Disclosure>
                    ))}

                    {/* Cash Balances for this currency */}
                    {(() => {
                      const cashForCurrency = totals?.cashBalances?.filter(cb => cb.currency === currencyGroup.currency) ?? [];
                      if (cashForCurrency.length === 0) return null;
                      return (
                        <div className='mt-2 p-4 border border-border rounded-lg bg-amber-50 dark:bg-amber-950/20'>
                          <h4 className='text-sm font-semibold text-foreground mb-3'>
                            💰 Idle Cash ({currencyGroup.currency})
                          </h4>
                          <div className='space-y-2'>
                            {cashForCurrency.map(cb => (
                              <div key={cb.accountId} className='flex justify-between items-center text-sm'>
                                <span className='text-muted-foreground'>{cb.accountName}</span>
                                <span className='font-medium text-foreground'>{formatCurrency(cb.amount, cb.currency as any)}</span>
                              </div>
                            ))}
                            {cashForCurrency.length > 1 && (
                              <div className='flex justify-between items-center text-sm pt-2 border-t border-border'>
                                <span className='font-semibold text-foreground'>Total Cash</span>
                                <span className='font-bold text-foreground'>
                                  {formatCurrency(cashForCurrency.reduce((s, cb) => s + cb.amount, 0), currencyGroup.currency as any)}
                                </span>
                              </div>
                            )}
                          </div>
                          {currencyGroup.currency === 'USD' && totals?.usdToAudRate && (
                            <p className='text-xs text-muted-foreground mt-2'>
                              ≈ {formatCurrency(cashForCurrency.reduce((s, cb) => s + cb.amount, 0) * totals.usdToAudRate, 'AUD')} AUD
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })
            ) : (
              /* ── Brokerage View: brokerage accordions → currency sub-sections ── */
              brokerageGroups.map((brokerageGroup) => (
                <Disclosure key={brokerageGroup.accountId} defaultOpen>
                  {({ open }) => (
                    <div className='border border-border rounded-lg overflow-hidden'>
                      <Disclosure.Button className='flex justify-between items-center w-full px-6 py-4 bg-muted hover:bg-muted/50 transition-colors'>
                        <div className='flex items-center gap-4'>
                          <ChevronDown
                            className={clsx(
                              'w-5 h-5 text-muted-foreground transition-transform',
                              open && 'rotate-180',
                            )}
                          />
                          <span className='text-base font-semibold text-foreground'>
                            {brokerageGroup.accountName}
                          </span>
                        </div>
                      </Disclosure.Button>

                      <Disclosure.Panel className='px-6 py-4 bg-card space-y-6'>
                        {brokerageGroup.currencies.map((currencySection) => {
                          const flag = currencySection.currency === 'AUD' ? '🇦🇺' : '🇺🇸';
                          return (
                            <div key={currencySection.currency}>
                              {/* Currency sub-header */}
                              <div className='mb-3 pb-1 border-b border-border'>
                                <div className='flex items-center justify-between'>
                                  <span className='text-sm font-semibold text-foreground'>
                                    {flag} {currencySection.currency}
                                  </span>
                                  <div className='flex items-center gap-4 text-sm'>
                                    <div className='text-right'>
                                      <p className='text-xs text-muted-foreground'>Invested</p>
                                      <p className='font-medium text-foreground'>
                                        {formatCurrency(currencySection.totalCostBasis, currencySection.currency)}
                                      </p>
                                    </div>
                                    <div className='text-right'>
                                      <p className='text-xs text-muted-foreground'>Current</p>
                                      <p className='font-medium text-foreground'>
                                        {formatCurrency(currencySection.totalMarketValue, currencySection.currency)}
                                      </p>
                                    </div>
                                    <div className='text-right'>
                                      <p className='text-xs text-muted-foreground'>P/L</p>
                                      <p className={clsx('font-semibold', getPLColorClass(currencySection.totalUnrealizedPL))}>
                                        {currencySection.totalUnrealizedPL >= 0 ? '+' : ''}
                                        {formatCurrency(currencySection.totalUnrealizedPL, currencySection.currency)}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                {currencySection.currency === 'USD' && totals?.usdToAudRate && (
                                  <p className='text-xs text-muted-foreground mt-1 text-right'>
                                    ≈ {formatCurrency(currencySection.totalMarketValue * totals.usdToAudRate, 'AUD')} AUD
                                    <span className='ml-2 opacity-70'>
                                      (1 USD = {Number(totals.usdToAudRate).toFixed(4)} AUD)
                                    </span>
                                  </p>
                                )}
                              </div>
                              <HoldingsTable
                                holdings={currencySection.holdings}
                                snapshotDate={snapshotDate}
                                snapshotId={selectedSnapshotId ?? ''}
                                accountId={brokerageGroup.accountId}
                                onEdit={(holding) => {
                                  setEditingHolding(holding);
                                  setIsHoldingFormModalOpen(true);
                                }}
                                onDeleteConfirm={(holdingId, ticker, sid) =>
                                  setDeleteHoldingConfirm({ holdingId, ticker, snapshotId: sid })
                                }
                                onAddHolding={handleAddHolding}
                              />
                            </div>
                          );
                        })}

                        {/* Cash Balances for this brokerage */}
                        {(() => {
                          const cashForBrokerage = totals?.cashBalances?.filter(cb => cb.accountId === brokerageGroup.accountId) ?? [];
                          if (cashForBrokerage.length === 0) return null;
                          return (
                            <div className='mt-2 p-4 border border-border rounded-lg bg-amber-50 dark:bg-amber-950/20'>
                              <h4 className='text-sm font-semibold text-foreground mb-3'>
                                💰 Idle Cash Balances
                              </h4>
                              <div className='space-y-2'>
                                {cashForBrokerage.map(cb => (
                                  <div key={`${cb.accountId}-${cb.currency}`} className='flex justify-between items-center text-sm'>
                                    <span className='text-muted-foreground flex items-center gap-1'>
                                      {cb.currency === 'AUD' ? '🇦🇺' : '🇺🇸'} {cb.currency}
                                    </span>
                                    <div className='text-right'>
                                      <span className='font-medium text-foreground'>{formatCurrency(cb.amount, cb.currency as any)}</span>
                                      {cb.currency === 'USD' && totals?.usdToAudRate && (
                                        <p className='text-xs text-muted-foreground'>
                                          ≈ {formatCurrency(cb.amount * totals.usdToAudRate, 'AUD')} AUD
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </Disclosure.Panel>
                    </div>
                  )}
                </Disclosure>
              ))
            )}
          </div>
        )}
      </div>

      {/* New Snapshot Modal */}
      <NewSnapshotModal
        isOpen={isNewSnapshotModalOpen || !!editingSnapshotId}
        onClose={() => {
          setIsNewSnapshotModalOpen(false);
          setEditingSnapshotId(null);
        }}
        onSuccess={() => {
          setIsNewSnapshotModalOpen(false);
          setEditingSnapshotId(null);
          refetchSnapshots();
          refetchBrokerageAccounts();
          refetchBrokerageInstitutions();
        }}
        snapshotId={editingSnapshotId || undefined}
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
