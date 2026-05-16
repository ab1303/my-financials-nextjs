'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BeneficiaryEnumType } from '@prisma/client';
import { AppSelect as Select } from '@/components/ui/AppSelect';
import CreatableSelect from 'react-select/creatable';
import { getSelectStyles } from '@/lib/select-styles';
import { toast } from 'sonner';

import { trpc } from '@/server/trpc/client';
import { addRow } from '../actions';
import CreateBeneficiaryModal from './CreateBeneficiaryModal';



type LinkTransactionsDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  dateFrom: string;
  dateTo: string;
  calendarYearId: string;
};

const linkFormSchema = z.object({
  taxCategory: z.string().min(1, 'Tax category is required'),
  beneficiaryType: z.nativeEnum(BeneficiaryEnumType),
  beneficiaryId: z.string().min(1, 'Please select a beneficiary'),
});

type LinkFormValues = z.infer<typeof linkFormSchema>;

type TransactionRow = {
  id: string;
  date: string;
  description: string;
  amount: number;
};

type BeneficiaryOption = {
  id: string;
  name: string;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount);
}

export default function LinkTransactionsDrawer({
  isOpen,
  onClose,
  dateFrom,
  dateTo,
  calendarYearId,
}: LinkTransactionsDrawerProps) {
  const [transactions, setTransactions] = useState<Array<TransactionRow>>([]);
  const [selectedTransactionId, setSelectedTransactionId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [pendingBeneficiaryName, setPendingBeneficiaryName] = useState('');

  const unlinkedTransactionsQuery = trpc.transactionLedger.getUnlinkedDonationTransactions.useQuery(
    { dateFrom, dateTo },
    { enabled: isOpen },
  );
  const individualsQuery = trpc.individual.getAllIndividuals.useQuery(undefined, {
    enabled: isOpen,
  });
  const businessesQuery = trpc.business.getBusinessesByType.useQuery(
    { type: 'PHILANTHROPY' },
    { enabled: isOpen },
  );

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isValid },
  } = useForm<LinkFormValues>({
    resolver: zodResolver(linkFormSchema),
    mode: 'onChange',
    defaultValues: {
      taxCategory: '',
      beneficiaryType: BeneficiaryEnumType.INDIVIDUAL,
      beneficiaryId: '',
    },
  });

  const beneficiaryType = watch('beneficiaryType');
  const selectedTransaction = useMemo(
    () => transactions.find((transaction) => transaction.id === selectedTransactionId),
    [selectedTransactionId, transactions],
  );

  useEffect(() => {
    if (unlinkedTransactionsQuery.data) {
      setTransactions(unlinkedTransactionsQuery.data);
    }
  }, [unlinkedTransactionsQuery.data]);

  useEffect(() => {
    setValue('beneficiaryId', '');
  }, [beneficiaryType, setValue]);

  useEffect(() => {
    if (transactions.length === 0) {
      setSelectedTransactionId('');
    }
  }, [transactions]);

  const individualOptions: Array<BeneficiaryOption> =
    individualsQuery.data?.map((individual: { id: string; name: string }) => ({
      id: individual.id,
      name: individual.name,
    })) ?? [];

  const businessOptions: Array<BeneficiaryOption> =
    businessesQuery.data?.map((business: { id: string; name: string }) => ({
      id: business.id,
      name: business.name,
    })) ?? [];

  const handleSelectTransaction = (transactionId: string) => {
    setSelectedTransactionId(transactionId);
    reset({
      taxCategory: '',
      beneficiaryType: BeneficiaryEnumType.INDIVIDUAL,
      beneficiaryId: '',
    });
  };

  const handleClose = () => {
    setTransactions([]);
    setSelectedTransactionId('');
    reset({
      taxCategory: '',
      beneficiaryType: BeneficiaryEnumType.INDIVIDUAL,
      beneficiaryId: '',
    });
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!selectedTransaction) {
      toast.error('Please select a transaction to link.');
      return;
    }

    setIsSaving(true);
    try {
      const result = await addRow({
        datePaid: new Date(selectedTransaction.date),
        amount: selectedTransaction.amount,
        taxCategory: values.taxCategory,
        beneficiaryType: values.beneficiaryType,
        beneficiaryId: values.beneficiaryId,
        calendarYearId,
        transactionId: selectedTransaction.id,
        donationPurpose: 'INTEREST_CLEANSING',
      });

      if (!result.success) {
        toast.error(
          typeof result.error === 'string' ? result.error : 'Failed to link donation',
        );
        return;
      }

      toast.success('Donation linked!');
      setTransactions((current) => {
        const remaining = current.filter((transaction) => transaction.id !== selectedTransaction.id);
        setSelectedTransactionId(remaining[0]?.id ?? '');
        return remaining;
      });
      reset({
        taxCategory: '',
        beneficiaryType: BeneficiaryEnumType.INDIVIDUAL,
        beneficiaryId: '',
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to link donation');
    } finally {
      setIsSaving(false);
    }
  });

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {createPortal(
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <div className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Link Transactions
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Enrich unlinked donation transactions with recipient details.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-md px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
              >
                Close
              </button>
            </div>

            <div className="grid flex-1 grid-cols-5 gap-0 overflow-hidden">
          <aside className="col-span-2 border-r border-gray-200 p-4 dark:border-gray-800">
            <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-200">
              Unlinked transactions
            </h3>

            {unlinkedTransactionsQuery.isLoading ? (
              <p className="text-sm text-gray-500">Loading transactions...</p>
            ) : transactions.length === 0 ? (
              <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700">
                No unlinked donation transactions found.
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto">
                {transactions.map((transaction) => {
                  const selected = transaction.id === selectedTransactionId;
                  return (
                    <button
                      key={transaction.id}
                      type="button"
                      onClick={() => handleSelectTransaction(transaction.id)}
                      className={`w-full rounded-md border p-3 text-left transition ${
                        selected
                          ? 'border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-950'
                          : 'border-gray-200 hover:border-amber-300 hover:bg-gray-50 dark:border-gray-800 dark:hover:border-amber-700 dark:hover:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-medium text-gray-500">{transaction.date}</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(transaction.amount)}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-gray-700 dark:text-gray-300">
                        {transaction.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <section className="col-span-3 flex flex-col p-4">
            <div className="flex flex-1 flex-col gap-4">
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
                {selectedTransaction ? (
                  <>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-500">Date</p>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {selectedTransaction.date}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Amount</p>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {formatCurrency(selectedTransaction.amount)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                      {selectedTransaction.description}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">
                    Select a transaction from the left to enrich it.
                  </p>
                )}
              </div>

              <div className="grid gap-4">
                <div>
                  <label htmlFor="taxCategory" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Tax category
                  </label>
                  <Controller
                    control={control}
                    name="taxCategory"
                    render={({ field }) => (
                      <input
                        id="taxCategory"
                        {...field}
                        disabled={!selectedTransaction}
                        type="text"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-amber-500 disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:disabled:bg-gray-800"
                        placeholder="e.g. Deductible gift recipient"
                      />
                    )}
                  />
                  {errors.taxCategory ? (
                    <p className="mt-1 text-xs text-red-600">{errors.taxCategory.message}</p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Beneficiary type
                  </label>
                  <Controller
                    control={control}
                    name="beneficiaryType"
                    render={({ field }) => (
                      <Select
                        inputId="beneficiaryType"
                        isDisabled={!selectedTransaction}
                        options={[
                          { value: BeneficiaryEnumType.INDIVIDUAL, label: 'Individual' },
                          { value: BeneficiaryEnumType.BUSINESS, label: 'Business' },
                        ]}
                        value={{
                          value: field.value,
                          label: field.value === BeneficiaryEnumType.BUSINESS ? 'Business' : 'Individual',
                        }}
                        onChange={(option) => field.onChange(option?.value)}
                      />
                    )}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Beneficiary
                  </label>
                  <Controller
                    control={control}
                    name="beneficiaryId"
                    render={({ field }) => {
                      const options = (
                        beneficiaryType === BeneficiaryEnumType.BUSINESS
                          ? businessOptions
                          : individualOptions
                      ).map((o) => ({ value: o.id, label: o.name }));
                      const selected = options.find((o) => o.value === field.value) ?? null;
                      return (
                        <CreatableSelect
                          inputId="beneficiaryId"
                          isDisabled={!selectedTransaction}
                          options={options}
                          value={selected}
                          onChange={(option) => field.onChange(option?.value ?? '')}
                          onCreateOption={(inputValue) => {
                            setPendingBeneficiaryName(inputValue);
                            setCreateModalOpen(true);
                          }}
                          placeholder="Select or create a beneficiary…"
                          formatCreateLabel={(inputValue) => `+ Create "${inputValue}"`}
                          styles={{
                            ...getSelectStyles<{ value: string; label: string }>(),
                            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                          }}
                          menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                          menuPosition="fixed"
                        />
                      );
                    }}
                  />
                  {errors.beneficiaryId ? (
                    <p className="mt-1 text-xs text-red-600">{errors.beneficiaryId.message}</p>
                  ) : null}
                </div>
              </div>

              <div className="mt-auto flex items-center justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-800">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={!selectedTransaction || !isValid || isSaving}
                  className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save & Next'}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body,
      )}
      <CreateBeneficiaryModal
        isOpen={createModalOpen}
        beneficiaryType={beneficiaryType}
        initialName={pendingBeneficiaryName}
        onClose={() => {
          setCreateModalOpen(false);
          setPendingBeneficiaryName('');
        }}
        onCreated={(id, _name) => {
          setValue('beneficiaryId', id, { shouldValidate: true });
          setCreateModalOpen(false);
          setPendingBeneficiaryName('');
        }}
      />
    </>
  );
}
