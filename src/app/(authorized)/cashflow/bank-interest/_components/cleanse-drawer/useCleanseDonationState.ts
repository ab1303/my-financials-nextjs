'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BeneficiaryEnumType } from '@prisma/client';
import { toast } from 'sonner';
import { trpc } from '@/server/trpc/client';
import { addRow } from '@/app/(authorized)/cashflow/donations/actions';
import {
  DrawerMode,
  TransactionRow,
  BeneficiaryOption,
  EvidenceItem,
  LinkedFormValues,
  ManualFormValues,
  CleanseDonationDrawerProps,
} from './types';
import {
  linkedModeSchema,
  manualModeSchema,
  getDefaultLinkedValues,
  getDefaultManualValues,
} from './schemas';

export function useCleanseDonationState({
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
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // M:N Allocations State
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem[]>([]);

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

  const handleToggleEvidence = (ev: EvidenceItem) => {
    setSelectedEvidence((prev) => {
      const exists = prev.find((p) => p.id === ev.id);
      if (exists) {
        return prev.filter((p) => p.id !== ev.id);
      } else {
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
      toast.error(`Total allocated exceeds credit amount.`);
      return;
    }

    setIsSaving(true);
    try {
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
        toast.error((result.error as string) || 'Failed to save');
        return;
      }

      await applyMutation.mutateAsync({
        creditId: selectedTransaction.id,
        allocations: selectedEvidence.map((ev) => ({
          evidenceId: ev.id,
          amount: ev.amount,
        })),
      });

      toast.success('Cleansing donation linked!');
      onDonationSaved();

      setTransactions((current) => {
        const remaining = current.filter(
          (item) => item.id !== selectedTransaction.id,
        );
        setSelectedTransactionId(remaining[0]?.id ?? '');
        return remaining;
      });
      setSelectedEvidence([]);
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
        toast.error((result.error as string) || 'Failed to save');
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

  return {
    mode,
    transactions,
    selectedTransactionId,
    isSaving,
    createModalOpen,
    setCreateModalOpen,
    pendingBeneficiaryName,
    setPendingBeneficiaryName,
    isPickerOpen,
    setIsPickerOpen,
    isMounted,
    selectedEvidence,
    linkedForm,
    manualForm,
    linkedBeneficiaryType,
    manualBeneficiaryType,
    unlinkedTxQuery,
    suggestQuery,
    selectedTransaction,
    individualOptions,
    businessOptions,
    getBeneficiaryOptions,
    handleSelectTransaction,
    handleClose,
    handleSwitchMode,
    handleToggleEvidence,
    updateEvidenceAmount,
    handleLinkedSave,
    handleManualSave,
  };
}
