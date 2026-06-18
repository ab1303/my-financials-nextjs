'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { BeneficiaryEnumType } from '@prisma/client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { addRow } from '@/app/(authorized)/cashflow/donations/actions';
import { trpc } from '@/server/trpc/client';

import {
  getDefaultLinkedValues,
  getDefaultManualValues,
  linkedModeSchema,
  manualModeSchema,
} from './schemas';
import type {
  BeneficiaryOption,
  CleanseDonationDrawerProps,
  DrawerMode,
  EvidenceItem,
  LinkedFormValues,
  ManualFormValues,
  TransactionRow,
} from './types';

export function useCleanseDonationState({
  isOpen,
  onClose,
  institutionId,
  calendarYearId,
  dateFrom,
  dateTo,
  onDonationSaved,
}: CleanseDonationDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerMode>('linked');
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

  const shouldFetchLinkedTransactions = isOpen;

  const unlinkedTxQuery =
    trpc.bankInterest.getUnlinkedInterestTransactions.useQuery(
      { institutionId, dateFrom, dateTo },
      { enabled: shouldFetchLinkedTransactions },
    );

  const evidenceQuery = trpc.bankInterest.getInterestCleansingData.useQuery(
    { institutionId, calendarYearId },
    { enabled: shouldFetchLinkedTransactions },
  );

  const suggestQuery = trpc.bankInterest.suggestAllocations.useQuery(
    { creditId: selectedTransactionId },
    { enabled: !!selectedTransactionId },
  );

  const applyMutation = trpc.bankInterest.applyAllocations.useMutation();
  const removeMutation = trpc.bankInterest.removeAllocation.useMutation();
  const utils = trpc.useUtils();

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

  // Separate tab mode from audit view state
  const isAuditMode = useMemo(() => {
    if (!selectedTransaction) return false;
    return selectedTransaction.cleansedAmount >= selectedTransaction.amount;
  }, [selectedTransaction]);

  const handleSwitchMode = useCallback(
    (newMode: DrawerMode) => {
      setActiveTab(newMode);
      linkedForm.reset(getDefaultLinkedValues());
      manualForm.reset(getDefaultManualValues());
    },
    [linkedForm, manualForm],
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
    if (selectedTransactionId && evidenceQuery.data) {
      console.log('Evidence Query Data:', evidenceQuery.data);
      const cleansingPayment = evidenceQuery.data.cleansingDonations.find(
        (d) => d.interestTxId === selectedTransactionId,
      );
      if (cleansingPayment && cleansingPayment.evidence) {
        setSelectedEvidence(
          cleansingPayment.evidence.map((e) => ({
            id: e.id, // This is the DonationPaymentEvidence ID
            amount: e.amountApplied,
            description: e.description,
            date: new Date(e.date),
            score: 100,
          })),
        );
      } else {
        setSelectedEvidence([]);
      }
    } else if (selectedTransactionId) {
      setSelectedEvidence([]);
    }
  }, [selectedTransactionId, evidenceQuery.data]);

  useEffect(() => {
    if (!isOpen) {
      setActiveTab('linked');
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
    setSelectedEvidence([]);
    setSelectedTransactionId(txId);
    linkedForm.reset({
      ...getDefaultLinkedValues(),
      beneficiaryType: linkedForm.getValues('beneficiaryType'),
    });
  };

  const handleClose = () => {
    setTransactions([]);
    setSelectedTransactionId('');
    setSelectedEvidence([]);
    linkedForm.reset(getDefaultLinkedValues());
    manualForm.reset(getDefaultManualValues());
    onClose();
  };

  const handleUnlink = async (allocationId: string) => {
    setIsSaving(true);
    try {
      await removeMutation.mutateAsync({ allocationId });
      toast.success('Allocation removed');
      await utils.bankInterest.getUnlinkedInterestTransactions.invalidate();
      await utils.bankInterest.getInterestCleansingData.invalidate();
    } catch (e) {
      console.error('Failed to unlink:', e);
      toast.error(
        e instanceof Error ? e.message : 'Failed to unlink allocation',
      );
    } finally {
      setIsSaving(false);
    }
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
    if (!selectedTransaction) return;
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

      if (!result.success) throw new Error(result.error as string);

      await applyMutation.mutateAsync({
        creditId: selectedTransaction.id,
        allocations: selectedEvidence.map((ev) => ({
          evidenceId: ev.id,
          amount: ev.amount,
        })),
        sourceBusinessId: result.data?.beneficiaryId || null,
      });

      toast.success('Cleansing donation linked!');
      onDonationSaved();
      await utils.bankInterest.getUnlinkedInterestTransactions.invalidate();
      await utils.bankInterest.getInterestCleansingData.invalidate();
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
      if (!result.success) throw new Error(result.error as string);
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
    isOpen,
    mode: activeTab,
    isAuditMode,
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
    handleUnlink, // Ensure handleUnlink is returned
  };
}
