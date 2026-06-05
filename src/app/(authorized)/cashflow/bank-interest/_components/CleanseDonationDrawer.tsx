'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { BeneficiaryEnumType } from '@prisma/client';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import CreatableSelect from 'react-select/creatable';
import type { Control, FieldErrors, UseFormReturn } from 'react-hook-form';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Check, Info, Trash2 } from 'lucide-react';

import { AppSelect as Select } from '@/components/ui/AppSelect';
import { addRow } from '@/app/(authorized)/cashflow/donations/actions';
import CreateBeneficiaryModal from '@/app/(authorized)/cashflow/donations/_components/CreateBeneficiaryModal';
import { getSelectStyles } from '@/lib/select-styles';
import { trpc } from '@/server/trpc/client';
import { Badge } from '@/components/ui/badge';
import { CleansingCandidatePicker } from './CleansingCandidatePicker';

// ---------- Types ----------

type DrawerMode = 'linked' | 'manual';

type TransactionRow = {
  id: string;
  date: string;
  description: string;
  amount: number;
};

type BeneficiaryOption = { value: string; label: string };

export type CleanseDonationDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  bankId: string;
  calendarYearId: string;
  dateFrom: string;
  dateTo: string;
  onDonationSaved: () => void;
};

// ---------- Schemas ----------

const linkedModeSchema = z.object({
  beneficiaryType: z.nativeEnum(BeneficiaryEnumType),
  beneficiaryId: z.string().min(1, 'Please select a beneficiary'),
});

const manualModeSchema = z.object({
  datePaid: z.string().min(1, 'Date is required'),
  amount: z
    .number({ required_error: 'Amount is required' })
    .positive('Must be greater than 0'),
  beneficiaryType: z.nativeEnum(BeneficiaryEnumType),
  beneficiaryId: z.string().min(1, 'Please select a beneficiary'),
});

type LinkedFormValues = z.infer<typeof linkedModeSchema>;
type ManualFormValues = z.infer<typeof manualModeSchema>;

// ---------- Helpers ----------

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount);
}

function getDefaultLinkedValues(): LinkedFormValues {
  return {
    beneficiaryType: BeneficiaryEnumType.INDIVIDUAL,
    beneficiaryId: '',
  };
}

function getDefaultManualValues(): ManualFormValues {
  return {
    datePaid: '',
    amount: 0,
    beneficiaryType: BeneficiaryEnumType.INDIVIDUAL,
    beneficiaryId: '',
  };
}

// ---------- Component ----------

export default function CleanseDonationDrawer({
  isOpen,
  onClose,
  bankId,
  calendarYearId,
  dateFrom,
  dateTo,
  onDonationSaved,
}: CleanseDonationDrawerProps) {
  const [mode, setMode] = useState<DrawerMode>('linked');
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [selectedTransactionId, setSelectedTransactionId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [pendingBeneficiaryName, setPendingBeneficiaryName] = useState('');

  // M:N Allocations State
  const [selectedEvidence, setSelectedEvidence] = useState<
    Array<{
      id: string;
      amount: number;
      description: string;
      date?: Date;
      score: number;
    }>
  >([]);

  const linkedForm = useForm<LinkedFormValues>({
    resolver: zodResolver(linkedModeSchema),
    mode: 'onChange',
    defaultValues: getDefaultLinkedValues(),
  });

  const manualForm = useForm<ManualFormValues>({
    resolver: zodResolver(manualModeSchema),
    mode: 'onChange',
    defaultValues: getDefaultManualValues(),
  });

  const linkedBeneficiaryType = linkedForm.watch('beneficiaryType');
  const manualBeneficiaryType = manualForm.watch('beneficiaryType');

  const shouldFetchLinkedTransactions = isOpen && mode === 'linked';

  const unlinkedTxQuery =
    trpc.bankInterest.getUnlinkedInterestTransactions.useQuery(
      { bankId, dateFrom, dateTo },
      { enabled: shouldFetchLinkedTransactions },
    );

  const suggestQuery = trpc.bankInterest.suggestAllocations.useQuery(
    { creditId: selectedTransactionId },
    { enabled: !!selectedTransactionId && mode === 'linked' },
  );

  const applyMutation = trpc.bankInterest.applyAllocations.useMutation();

  const individualsQuery = trpc.individual.getAllIndividuals.useQuery(
    undefined,
    { enabled: isOpen },
  );
  const businessesQuery = trpc.business.getBusinessesByType.useQuery(
    { type: 'PHILANTHROPY' },
    { enabled: isOpen },
  );

  const selectedTransaction = useMemo(
    () => transactions.find((t) => t.id === selectedTransactionId),
    [transactions, selectedTransactionId],
  );

  useEffect(() => {
    if (isOpen && unlinkedTxQuery.data) {
      setTransactions(unlinkedTxQuery.data);
      if (!selectedTransactionId && unlinkedTxQuery.data[0]) {
        setSelectedTransactionId(unlinkedTxQuery.data[0].id);
      }
    }
  }, [unlinkedTxQuery.data, isOpen, selectedTransactionId]);

  // Temporary debug: log when transactions are set and which transaction is selected
  useEffect(() => {
    try {
      // eslint-disable-next-line no-console
      console.debug(
        '[CleanseDonationDrawer] selectedTransactionId=',
        selectedTransactionId,
      );
    } catch (e) {
      // ignore
    }
  }, [selectedTransactionId]);

  useEffect(() => {
    linkedForm.setValue('beneficiaryId', '', { shouldValidate: true });
  }, [linkedBeneficiaryType, linkedForm]);

  useEffect(() => {
    manualForm.setValue('beneficiaryId', '', { shouldValidate: true });
  }, [manualBeneficiaryType, manualForm]);

  useEffect(() => {
    if (!isOpen) {
      setMode('linked');
      setTransactions([]);
      setSelectedTransactionId('');
      setSelectedEvidence([]);
      setIsSaving(false);
      setCreateModalOpen(false);
      setPendingBeneficiaryName('');
      linkedForm.reset(getDefaultLinkedValues());
      manualForm.reset(getDefaultManualValues());
    }
  }, [isOpen, linkedForm, manualForm]);

  const individualOptions: BeneficiaryOption[] =
    individualsQuery.data?.map((item: { id: string; name: string }) => ({
      value: item.id,
      label: item.name,
    })) ?? [];

  const businessOptions: BeneficiaryOption[] =
    businessesQuery.data?.map((item: { id: string; name: string }) => ({
      value: item.id,
      label: item.name,
    })) ?? [];

  const getBeneficiaryOptions = (type: BeneficiaryEnumType) =>
    type === BeneficiaryEnumType.BUSINESS ? businessOptions : individualOptions;

  const handleSelectTransaction = (txId: string) => {
    setSelectedTransactionId(txId);
    setSelectedEvidence([]);
    linkedForm.reset({
      ...getDefaultLinkedValues(),
      beneficiaryType: linkedForm.getValues('beneficiaryType'),
    });
  };

  const handleClose = () => {
    setTransactions([]);
    setSelectedTransactionId('');
    setSelectedEvidence([]);
    setMode('linked');
    linkedForm.reset(getDefaultLinkedValues());
    manualForm.reset(getDefaultManualValues());
    onClose();
  };

  const handleSwitchMode = (newMode: DrawerMode) => {
    setMode(newMode);
    linkedForm.reset(getDefaultLinkedValues());
    manualForm.reset(getDefaultManualValues());
  };

  const toggleEvidence = (ev: {
    id: string;
    amount: number;
    description: string;
    date?: Date;
    score: number;
  }) => {
    setSelectedEvidence((prev) => {
      const exists = prev.find((p) => p.id === ev.id);
      if (exists) {
        return prev.filter((p) => p.id !== ev.id);
      } else {
        // Calculate auto-suggested amount based on remaining credit
        const totalAllocated = prev.reduce((s, a) => s + a.amount, 0);
        const creditRemaining = Math.max(
          0,
          (selectedTransaction?.amount ?? 0) - totalAllocated,
        );
        const amount = Math.min(ev.amount, creditRemaining);
        return [...prev, { ...ev, amount }];
      }
    });
  };

  const updateEvidenceAmount = (id: string, amount: number) => {
    setSelectedEvidence((prev) =>
      prev.map((ev) => (ev.id === id ? { ...ev, amount } : ev)),
    );
  };

  const handleLinkedSave = linkedForm.handleSubmit(async (values) => {
    if (!selectedTransaction) {
      toast.error('Please select a transaction to link.');
      return;
    }

    const totalAllocated = selectedEvidence.reduce((s, a) => s + a.amount, 0);
    if (totalAllocated <= 0) {
      toast.error('Please select at least one evidence transaction.');
      return;
    }

    if (totalAllocated > selectedTransaction.amount + 0.01) {
      toast.error(
        `Total allocated (${formatCurrency(totalAllocated)}) exceeds credit amount (${formatCurrency(selectedTransaction.amount)}).`,
      );
      return;
    }

    setIsSaving(true);
    try {
      // 1. Create/Link the donation payment
      // The addRow action creates a DonationPayment linked 1:1 to the interestTxId
      // Then we use the evidence table for the M:N evidence.
      const result = await addRow({
        datePaid: new Date(selectedTransaction.date),
        amount: selectedTransaction.amount,
        beneficiaryType: values.beneficiaryType,
        beneficiaryId: values.beneficiaryId,
        calendarYearId,
        transactionId: selectedTransaction.id,
        donationPurpose: 'INTEREST_CLEANSING',
      });

      if (!result.success) {
        toast.error(
          typeof result.error === 'string'
            ? result.error
            : 'Failed to save cleansing donation',
        );
        return;
      }

      // 2. Apply M:N Evidence allocations via tRPC
      await applyMutation.mutateAsync({
        creditId: selectedTransaction.id,
        allocations: selectedEvidence.map((ev) => ({
          evidenceId: ev.id,
          amount: ev.amount,
        })),
      });

      toast.success('Cleansing donation and evidence linked!');
      onDonationSaved();

      setTransactions((current) => {
        const remaining = current.filter(
          (item) => item.id !== selectedTransaction.id,
        );
        setSelectedTransactionId(remaining[0]?.id ?? '');
        return remaining;
      });
      setSelectedEvidence([]);
      linkedForm.reset({
        ...getDefaultLinkedValues(),
        beneficiaryType: values.beneficiaryType,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  });

  const handleManualSave = manualForm.handleSubmit(async (values) => {
    setIsSaving(true);
    try {
      const result = await addRow({
        datePaid: new Date(values.datePaid),
        amount: values.amount,
        beneficiaryType: values.beneficiaryType,
        beneficiaryId: values.beneficiaryId,
        calendarYearId,
        donationPurpose: 'INTEREST_CLEANSING',
      });

      if (!result.success) {
        toast.error(
          typeof result.error === 'string'
            ? result.error
            : 'Failed to save cleansing donation',
        );
        return;
      }

      toast.success('Manual cleansing donation saved!');
      onDonationSaved();
      manualForm.reset(getDefaultManualValues());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  });

  if (!isOpen) return null;

  const drawerContent = (
    <div
      className='fixed inset-0 z-50 flex justify-end bg-black/40 dark:bg-black/60'
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className='flex h-full w-full max-w-4xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-gray-900'>
        <div className='flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800'>
          <div>
            <h2 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
              Record Cleansing Donation
            </h2>
            <p className='text-sm text-gray-500 dark:text-gray-400'>
              Cleanse interest by recording the donation and linking evidence.
            </p>
          </div>
          <button
            type='button'
            onClick={handleClose}
            className='rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100'
          >
            Close
          </button>
        </div>

        <div className='flex gap-2 border-b border-gray-200 px-6 py-3 dark:border-gray-800'>
          <button
            type='button'
            onClick={() => handleSwitchMode('linked')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              mode === 'linked'
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
            }`}
          >
            Linked (M:N)
          </button>
          <button
            type='button'
            onClick={() => handleSwitchMode('manual')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              mode === 'manual'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
            }`}
          >
            Manual
          </button>
        </div>

        {mode === 'linked' ? (
          <LinkedModeBody
            transactions={transactions}
            selectedTransactionId={selectedTransactionId}
            isLoadingTx={unlinkedTxQuery.isLoading}
            onSelectTransaction={handleSelectTransaction}
            selectedTransaction={selectedTransaction}
            form={linkedForm}
            beneficiaryOptions={getBeneficiaryOptions(linkedBeneficiaryType)}
            beneficiaryType={linkedBeneficiaryType}
            isSaving={isSaving}
            onSave={handleLinkedSave}
            onClose={handleClose}
            createModalOpen={createModalOpen}
            setCreateModalOpen={setCreateModalOpen}
            pendingBeneficiaryName={pendingBeneficiaryName}
            setPendingBeneficiaryName={setPendingBeneficiaryName}
            onBeneficiaryCreated={(id) =>
              linkedForm.setValue('beneficiaryId', id, { shouldValidate: true })
            }
            suggestions={suggestQuery.data || []}
            isSuggesting={suggestQuery.isLoading}
            selectedEvidence={selectedEvidence}
            onToggleEvidence={toggleEvidence}
            onUpdateAmount={updateEvidenceAmount}
          />
        ) : (
          <ManualModeBody
            form={manualForm}
            beneficiaryOptions={getBeneficiaryOptions(manualBeneficiaryType)}
            beneficiaryType={manualBeneficiaryType}
            isSaving={isSaving}
            onSave={handleManualSave}
            onClose={handleClose}
            createModalOpen={createModalOpen}
            setCreateModalOpen={setCreateModalOpen}
            pendingBeneficiaryName={pendingBeneficiaryName}
            setPendingBeneficiaryName={setPendingBeneficiaryName}
            onBeneficiaryCreated={(id) =>
              manualForm.setValue('beneficiaryId', id, { shouldValidate: true })
            }
          />
        )}
      </div>
    </div>
  );

  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  if (!portalTarget) return null;

  return createPortal(drawerContent, portalTarget);
}

type LinkedModeBodyProps = {
  transactions: TransactionRow[];
  selectedTransactionId: string;
  isLoadingTx: boolean;
  onSelectTransaction: (id: string) => void;
  selectedTransaction: TransactionRow | undefined;
  form: UseFormReturn<LinkedFormValues>;
  beneficiaryOptions: BeneficiaryOption[];
  beneficiaryType: BeneficiaryEnumType;
  isSaving: boolean;
  onSave: () => void;
  onClose: () => void;
  createModalOpen: boolean;
  setCreateModalOpen: (value: boolean) => void;
  pendingBeneficiaryName: string;
  setPendingBeneficiaryName: (value: string) => void;
  onBeneficiaryCreated: (id: string) => void;
  suggestions: Array<{
    donationPaymentId: string;
    donationTransactionId: string | null;
    evidenceAmount: number;
    score: number;
    suggestedAmount: number;
  }>;
  isSuggesting: boolean;
  selectedEvidence: Array<{
    id: string;
    amount: number;
    description: string;
    date?: Date;
    score: number;
  }>;
  onToggleEvidence: (ev: {
    id: string;
    amount: number;
    description: string;
    date?: Date;
    score: number;
  }) => void;
  onUpdateAmount: (id: string, amount: number) => void;
};

function LinkedModeBody({
  transactions,
  selectedTransactionId,
  isLoadingTx,
  onSelectTransaction,
  selectedTransaction,
  form,
  beneficiaryOptions,
  beneficiaryType,
  isSaving,
  onSave,
  onClose,
  createModalOpen,
  setCreateModalOpen,
  pendingBeneficiaryName,
  setPendingBeneficiaryName,
  onBeneficiaryCreated,
  suggestions,
  isSuggesting,
  selectedEvidence,
  onToggleEvidence,
  onUpdateAmount,
}: LinkedModeBodyProps) {
  const {
    control,
    formState: { errors, isValid },
  } = form;

  const totalAllocated = selectedEvidence.reduce((s, a) => s + a.amount, 0);
  const creditAmount = selectedTransaction?.amount ?? 0;
  const remaining = Math.max(0, creditAmount - totalAllocated);

  return (
    <>
      <div className='grid flex-1 grid-cols-12 overflow-hidden'>
        {/* Left: Unlinked Interest Credits */}
        <aside className='col-span-3 overflow-y-auto border-r border-gray-200 p-4 dark:border-gray-800'>
          <h3 className='mb-3 text-sm font-medium text-gray-700 dark:text-gray-200'>
            Unlinked interest
          </h3>
          {isLoadingTx ? (
            <p className='text-sm text-gray-500 dark:text-gray-400'>
              Loading...
            </p>
          ) : transactions.length === 0 ? (
            <div className='rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400'>
              No unlinked interest found.
            </div>
          ) : (
            <div className='space-y-2'>
              {transactions.map((tx) => {
                const selected = tx.id === selectedTransactionId;
                return (
                  <button
                    key={tx.id}
                    type='button'
                    onClick={() => onSelectTransaction(tx.id)}
                    className={`w-full rounded-md border p-3 text-left transition ${
                      selected
                        ? 'border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-950'
                        : 'border-gray-200 hover:border-amber-300 hover:bg-gray-50 dark:border-gray-800 dark:hover:border-amber-700 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className='flex items-center justify-between gap-2'>
                      <span className='text-xs text-gray-500 dark:text-gray-400'>
                        {tx.date}
                      </span>
                      <span className='text-sm font-semibold text-gray-900 dark:text-gray-100'>
                        {formatCurrency(tx.amount)}
                      </span>
                    </div>
                    <p className='mt-1 line-clamp-1 text-xs text-gray-600 dark:text-gray-400'>
                      {tx.description}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* Middle: Evidence Picker */}
        <section className='col-span-6 flex flex-col overflow-hidden border-r border-gray-200 dark:border-gray-800'>
          <div className='flex flex-1 flex-col overflow-hidden p-4'>
            <div className='mb-4 flex items-center justify-between'>
              <h3 className='text-sm font-medium text-gray-700 dark:text-gray-200'>
                Select Evidence (DEBITs)
              </h3>
              {selectedTransaction && (
                <div className='flex gap-2'>
                  <Badge variant={remaining === 0 ? 'default' : 'secondary'}>
                    Remaining: {formatCurrency(remaining)}
                  </Badge>
                </div>
              )}
            </div>

            {!selectedTransaction ? (
              <div className='flex flex-1 items-center justify-center rounded-md border border-dashed border-gray-300 dark:border-gray-700'>
                <p className='text-sm text-gray-500 dark:text-gray-400'>
                  Select an interest credit to see suggestions.
                </p>
              </div>
            ) : (
              <CleansingCandidatePicker
                creditId={selectedTransactionId}
                onSelect={(candidate) =>
                  onToggleEvidence({
                    id: candidate.transactionId,
                    amount: candidate.amount,
                    description: candidate.description,
                    date: new Date(candidate.date),
                    score: candidate.score,
                  })
                }
              />
            )}
          </div>
        </section>

        {/* Right: Confirmation & Beneficiary */}
        <section className='col-span-3 flex flex-col overflow-hidden p-4'>
          <h3 className='mb-3 text-sm font-medium text-gray-700 dark:text-gray-200'>
            Allocation Summary
          </h3>

          <div className='mb-4 space-y-3'>
            <div className='rounded-md bg-gray-50 p-3 dark:bg-gray-950'>
              <div className='flex justify-between text-xs text-gray-500 mb-1'>
                <span>Interest Credit</span>
                <span>{formatCurrency(creditAmount)}</span>
              </div>
              <div className='flex justify-between text-xs font-semibold text-blue-600 dark:text-blue-400'>
                <span>Total Allocated</span>
                <span>{formatCurrency(totalAllocated)}</span>
              </div>
            </div>

            {selectedEvidence.length > 0 && (
              <div className='max-h-40 overflow-y-auto rounded-md border border-gray-100 dark:border-gray-800'>
                {selectedEvidence.map((ev) => (
                  <div
                    key={ev.id}
                    className='flex items-center justify-between border-b border-gray-50 p-2 last:border-0 dark:border-gray-900'
                  >
                    <div className='min-w-0 flex-1'>
                      <p className='truncate text-[10px] text-gray-700 dark:text-gray-300'>
                        {ev.description}
                      </p>
                      <p className='text-[10px] text-gray-500'>
                        {formatCurrency(ev.amount)}
                      </p>
                    </div>
                    <button
                      onClick={() => onToggleEvidence(ev)}
                      className='text-gray-400 hover:text-red-500 transition-colors'
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className='mt-auto pt-4 border-t border-gray-100 dark:border-gray-800'>
            <BeneficiaryFormFields
              control={control}
              errors={errors}
              beneficiaryType={beneficiaryType}
              beneficiaryOptions={beneficiaryOptions}
              disabled={!selectedTransaction || selectedEvidence.length === 0}
              setCreateModalOpen={setCreateModalOpen}
              setPendingBeneficiaryName={setPendingBeneficiaryName}
            />

            <div className='mt-6 flex flex-col gap-2'>
              <button
                type='button'
                onClick={onSave}
                disabled={
                  !selectedTransaction ||
                  selectedEvidence.length === 0 ||
                  !isValid ||
                  isSaving
                }
                className='w-full rounded-md bg-amber-600 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-500 dark:hover:bg-amber-600'
              >
                {isSaving ? 'Processing...' : 'Confirm Allocation'}
              </button>
              <button
                type='button'
                onClick={onClose}
                className='w-full rounded-md border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'
              >
                Cancel
              </button>
            </div>
          </div>
        </section>
      </div>

      <CreateBeneficiaryModal
        isOpen={createModalOpen}
        beneficiaryType={beneficiaryType}
        initialName={pendingBeneficiaryName}
        onClose={() => {
          setCreateModalOpen(false);
          setPendingBeneficiaryName('');
        }}
        onCreated={(id) => {
          onBeneficiaryCreated(id);
          setCreateModalOpen(false);
          setPendingBeneficiaryName('');
        }}
      />
    </>
  );
}

type ManualModeBodyProps = {
  form: UseFormReturn<ManualFormValues>;
  beneficiaryOptions: BeneficiaryOption[];
  beneficiaryType: BeneficiaryEnumType;
  isSaving: boolean;
  onSave: () => void;
  onClose: () => void;
  createModalOpen: boolean;
  setCreateModalOpen: (value: boolean) => void;
  pendingBeneficiaryName: string;
  setPendingBeneficiaryName: (value: string) => void;
  onBeneficiaryCreated: (id: string) => void;
};

function ManualModeBody({
  form,
  beneficiaryOptions,
  beneficiaryType,
  isSaving,
  onSave,
  onClose,
  createModalOpen,
  setCreateModalOpen,
  pendingBeneficiaryName,
  setPendingBeneficiaryName,
  onBeneficiaryCreated,
}: ManualModeBodyProps) {
  const {
    control,
    register,
    formState: { errors, isValid },
  } = form;

  return (
    <>
      <div className='flex flex-1 flex-col overflow-y-auto p-6'>
        <div className='mx-auto w-full max-w-lg space-y-6'>
          <div className='rounded-md border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/30'>
            <div className='flex gap-3'>
              <Info className='h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0' />
              <div>
                <p className='text-sm font-medium text-blue-900 dark:text-blue-100'>
                  Manual Record
                </p>
                <p className='text-xs text-blue-700 dark:text-blue-300 mt-1'>
                  Use this mode to record a cleansing donation that was made
                  with cash or from an untracked bank account.
                </p>
              </div>
            </div>
          </div>

          <div className='grid gap-4'>
            <div>
              <label
                htmlFor='manual-datePaid'
                className='mb-1 block cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-200'
              >
                Date paid
              </label>
              <input
                id='manual-datePaid'
                type='date'
                {...register('datePaid')}
                className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100'
              />
              {errors.datePaid && (
                <p className='mt-1 text-xs text-red-600 dark:text-red-400'>
                  {errors.datePaid.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor='manual-amount'
                className='mb-1 block cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-200'
              >
                Donation amount (AUD)
              </label>
              <Controller
                control={control}
                name='amount'
                render={({ field }) => (
                  <input
                    id='manual-amount'
                    type='number'
                    step='0.01'
                    min='0.01'
                    value={field.value || ''}
                    onChange={(event) =>
                      field.onChange(parseFloat(event.target.value) || 0)
                    }
                    className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100'
                    placeholder='0.00'
                  />
                )}
              />
              {errors.amount && (
                <p className='mt-1 text-xs text-red-600 dark:text-red-400'>
                  {errors.amount.message}
                </p>
              )}
            </div>

            <BeneficiaryFormFields
              control={control}
              errors={errors}
              beneficiaryType={beneficiaryType}
              beneficiaryOptions={beneficiaryOptions}
              disabled={false}
              setCreateModalOpen={setCreateModalOpen}
              setPendingBeneficiaryName={setPendingBeneficiaryName}
            />
          </div>
        </div>
      </div>

      <div className='flex items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-800 dark:bg-gray-950'>
        <button
          type='button'
          onClick={onClose}
          className='rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'
        >
          Cancel
        </button>
        <button
          type='button'
          onClick={onSave}
          disabled={!isValid || isSaving}
          className='rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600'
        >
          {isSaving ? 'Saving...' : 'Save Manual Record'}
        </button>
      </div>

      <CreateBeneficiaryModal
        isOpen={createModalOpen}
        beneficiaryType={beneficiaryType}
        initialName={pendingBeneficiaryName}
        onClose={() => {
          setCreateModalOpen(false);
          setPendingBeneficiaryName('');
        }}
        onCreated={(id) => {
          onBeneficiaryCreated(id);
          setCreateModalOpen(false);
          setPendingBeneficiaryName('');
        }}
      />
    </>
  );
}

type BeneficiaryFormFieldsProps = {
  control: Control<any>;
  errors: FieldErrors<any>;
  beneficiaryType: BeneficiaryEnumType;
  beneficiaryOptions: BeneficiaryOption[];
  disabled: boolean;
  setCreateModalOpen: (value: boolean) => void;
  setPendingBeneficiaryName: (value: string) => void;
};

function BeneficiaryFormFields({
  control,
  errors,
  beneficiaryType,
  beneficiaryOptions,
  disabled,
  setCreateModalOpen,
  setPendingBeneficiaryName,
}: BeneficiaryFormFieldsProps) {
  return (
    <div className='grid gap-4'>
      <div>
        <label className='mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200'>
          Beneficiary type
        </label>
        <Controller
          control={control}
          name='beneficiaryType'
          render={({ field }) => (
            <Select
              inputId='beneficiaryType'
              isDisabled={disabled}
              options={[
                { value: BeneficiaryEnumType.INDIVIDUAL, label: 'Individual' },
                { value: BeneficiaryEnumType.BUSINESS, label: 'Business' },
              ]}
              value={{
                value: field.value,
                label:
                  field.value === BeneficiaryEnumType.BUSINESS
                    ? 'Business'
                    : 'Individual',
              }}
              onChange={(option) => field.onChange(option?.value)}
            />
          )}
        />
      </div>

      <div>
        <label
          htmlFor='beneficiaryId'
          className='mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200'
        >
          Beneficiary
        </label>
        <Controller
          control={control}
          name='beneficiaryId'
          render={({ field }) => {
            const selected =
              beneficiaryOptions.find((item) => item.value === field.value) ??
              null;
            return (
              <CreatableSelect
                inputId='beneficiaryId'
                isDisabled={disabled}
                options={beneficiaryOptions}
                value={selected}
                onChange={(option) => field.onChange(option?.value ?? '')}
                onCreateOption={(inputValue) => {
                  setPendingBeneficiaryName(inputValue);
                  setCreateModalOpen(true);
                }}
                placeholder='Select or create a beneficiary…'
                formatCreateLabel={(value) => `+ Create "${value}"`}
                styles={{
                  ...getSelectStyles<BeneficiaryOption>(),
                  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                }}
                menuPortalTarget={
                  typeof document !== 'undefined' ? document.body : null
                }
                menuPosition='fixed'
              />
            );
          }}
        />
        {errors.beneficiaryId && (
          <p className='mt-1 text-xs text-red-600 dark:text-red-400'>
            {String(errors.beneficiaryId.message)}
          </p>
        )}
      </div>
    </div>
  );
}
