'use client';

import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import CreateBeneficiaryModal from '@/app/(authorized)/cashflow/donations/_components/CreateBeneficiaryModal';
import { FullPageCleansingPanel } from '../FullPageCleansingPanel';
import { CleanseDonationDrawerProps } from './types';
import { useCleanseDonationState } from './useCleanseDonationState';
import { LinkedModeBody } from './LinkedModeBody';
import { ManualModeBody } from './ManualModeBody';

export function CleanseDonationDrawer(props: CleanseDonationDrawerProps) {
  const { isOpen } = props;
  const state = useCleanseDonationState(props);

  if (!isOpen || !state.isMounted) return null;

  const drawerContent = (
    <div
      className='fixed inset-0 z-50 flex justify-end bg-black/40 dark:bg-black/60 backdrop-blur-sm'
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          state.handleClose();
        }
      }}
    >
      <div className='flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-gray-900 animate-in slide-in-from-right duration-300'>
        {/* Header */}
        <div className='flex items-center justify-between border-b border-gray-200 px-8 py-6 dark:border-gray-800'>
          <div>
            <h2 className='text-2xl font-bold text-gray-900 dark:text-gray-100'>
              Record Cleansing Donation
            </h2>
            <p className='text-sm text-gray-500 dark:text-gray-400 mt-1'>
              Cleanse interest by recording the donation and linking evidence.
            </p>
          </div>
          <button
            type='button'
            onClick={state.handleClose}
            className='rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors'
          >
            <X className='h-6 w-6' />
          </button>
        </div>

        {/* Tabs */}
        <div className='flex gap-2 border-b border-gray-200 px-8 py-3 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/50'>
          <button
            type='button'
            onClick={() => state.handleSwitchMode('linked')}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition-all ${
              state.mode === 'linked'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800'
            }`}
          >
            Linked (M:N)
          </button>
          <button
            type='button'
            onClick={() => state.handleSwitchMode('manual')}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition-all ${
              state.mode === 'manual'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800'
            }`}
          >
            Manual
          </button>
        </div>

        {/* Body */}
        <div className='flex-1 overflow-hidden'>
          {state.mode === 'linked' ? (
            <LinkedModeBody
              transactions={state.transactions}
              selectedTransactionId={state.selectedTransactionId}
              isLoadingTx={state.unlinkedTxQuery.isLoading}
              onSelectTransaction={state.handleSelectTransaction}
              selectedTransaction={state.selectedTransaction}
              form={state.linkedForm}
              beneficiaryOptions={state.getBeneficiaryOptions(state.linkedBeneficiaryType)}
              beneficiaryType={state.linkedBeneficiaryType}
              isSaving={state.isSaving}
              onSave={state.handleLinkedSave}
              onClose={state.handleClose}
              createModalOpen={state.createModalOpen}
              setCreateModalOpen={state.setCreateModalOpen}
              pendingBeneficiaryName={state.pendingBeneficiaryName}
              setPendingBeneficiaryName={state.setPendingBeneficiaryName}
              onBeneficiaryCreated={(id) =>
                state.linkedForm.setValue('beneficiaryId', id, { shouldValidate: true })
              }
              suggestions={state.suggestQuery.data || []}
              isSuggesting={state.suggestQuery.isLoading}
              selectedEvidence={state.selectedEvidence}
              onToggleEvidence={state.toggleEvidence}
              onUpdateAmount={state.updateEvidenceAmount}
              onOpenPicker={() => state.setIsPickerOpen(true)}
            />
          ) : (
            <ManualModeBody
              form={state.manualForm}
              beneficiaryOptions={state.getBeneficiaryOptions(state.manualBeneficiaryType)}
              beneficiaryType={state.manualBeneficiaryType}
              isSaving={state.isSaving}
              onSave={state.handleManualSave}
              onClose={state.handleClose}
              createModalOpen={state.createModalOpen}
              setCreateModalOpen={state.setCreateModalOpen}
              pendingBeneficiaryName={state.pendingBeneficiaryName}
              setPendingBeneficiaryName={state.setPendingBeneficiaryName}
              onBeneficiaryCreated={(id) =>
                state.manualForm.setValue('beneficiaryId', id, { shouldValidate: true })
              }
            />
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(
    <>
      {drawerContent}
      {state.isPickerOpen && state.selectedTransaction && (
        <FullPageCleansingPanel
          creditId={state.selectedTransactionId}
          creditAmount={state.selectedTransaction.amount}
          creditDate={state.selectedTransaction.date}
          creditDescription={state.selectedTransaction.description}
          onClose={() => state.setIsPickerOpen(false)}
          onSelect={(candidate) => {
            state.toggleEvidence({
              id: candidate.transactionId,
              amount: candidate.amount,
              description: candidate.description,
              date: new Date(candidate.date),
              score: candidate.matchPercent,
            });
            state.setIsPickerOpen(false);
          }}
        />
      )}
      <CreateBeneficiaryModal
        isOpen={state.createModalOpen}
        beneficiaryType={
          state.mode === 'linked'
            ? state.linkedBeneficiaryType
            : state.manualBeneficiaryType
        }
        initialName={state.pendingBeneficiaryName}
        onClose={() => {
          state.setCreateModalOpen(false);
          state.setPendingBeneficiaryName('');
        }}
        onCreated={(id) => {
          if (state.mode === 'linked') {
            state.linkedForm.setValue('beneficiaryId', id, { shouldValidate: true });
          } else {
            state.manualForm.setValue('beneficiaryId', id, { shouldValidate: true });
          }
          state.setCreateModalOpen(false);
          state.setPendingBeneficiaryName('');
        }}
      />
    </>,
    document.body,
  );
}
