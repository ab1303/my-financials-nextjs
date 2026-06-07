'use client';

import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import CreateBeneficiaryModal from '@/app/(authorized)/cashflow/donations/_components/CreateBeneficiaryModal';
import { FullPageCleansingPanel } from '../FullPageCleansingPanel';
import { CleanseDonationDrawerProps } from './types';
import {
  CleanseDonationProvider,
  useCleanseDonation,
} from './CleanseDonationContext';
import { LinkedModeBody } from './LinkedModeBody';
import { ManualModeBody } from './ManualModeBody';

/**
 * Main Drawer Component (Public Entry Point)
 */
export function CleanseDonationDrawer(props: CleanseDonationDrawerProps) {
  return (
    <CleanseDonationProvider {...props}>
      <CleanseDonationPortalContent />
    </CleanseDonationProvider>
  );
}

/**
 * Internal Portal Content
 * Handles the "giant" layout composition and portal rendering.
 */
function CleanseDonationPortalContent() {
  const { isOpen, isMounted, handleClose } = useCleanseDonation();

  if (!isOpen || !isMounted) return null;

  return createPortal(
    <>
      <div
        className={cn(
          'fixed inset-0 z-50 flex justify-end bg-black/40 dark:bg-black/60 backdrop-blur-sm lg:ml-64'
        )}
        onClick={(event) => {
          if (event.target === event.currentTarget) handleClose();
        }}
      >
        <div className='flex h-full w-full flex-col bg-white shadow-2xl dark:bg-gray-900 animate-in slide-in-from-right duration-300'>
          <DrawerHeader />
          <DrawerTabs />
          <div className='flex-1 overflow-hidden'>
            <DrawerBody />
          </div>
        </div>
      </div>
      <DrawerModals />
    </>,
    document.body,
  );
}

function DrawerHeader() {
  const { handleClose } = useCleanseDonation();
  return (
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
        onClick={handleClose}
        className='rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors'
      >
        <X className='h-6 w-6' />
      </button>
    </div>
  );
}

function DrawerTabs() {
  const { mode, handleSwitchMode } = useCleanseDonation();
  return (
    <div className='flex gap-2 border-b border-gray-200 px-8 py-3 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/50'>
      <TabButton
        active={mode === 'linked'}
        onClick={() => handleSwitchMode('linked')}
        colorClass='bg-amber-600'
      >
        Linked (M:N)
      </TabButton>
      <TabButton
        active={mode === 'manual'}
        onClick={() => handleSwitchMode('manual')}
        colorClass='bg-blue-600'
      >
        Manual
      </TabButton>
    </div>
  );
}

function TabButton({
  children,
  active,
  onClick,
  colorClass,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  colorClass: string;
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={`rounded-md px-4 py-2 text-sm font-semibold transition-all ${
        active
          ? `${colorClass} text-white shadow-md`
          : 'text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800'
      }`}
    >
      {children}
    </button>
  );
}

function DrawerBody() {
  const { mode } = useCleanseDonation();
  return mode === 'linked' ? <LinkedModeBody /> : <ManualModeBody />;
}

function DrawerModals() {
  const {
    createModalOpen,
    setCreateModalOpen,
    setPendingBeneficiaryName,
    setIsPickerOpen,
    mode,
    pendingBeneficiaryName,
    linkedBeneficiaryType,
    manualBeneficiaryType,
    linkedForm,
    manualForm,
    isPickerOpen,
    selectedTransaction,
    selectedTransactionId,
    handleToggleEvidence,
  } = useCleanseDonation();

  return (
    <>
      {isPickerOpen && selectedTransaction && (
        <FullPageCleansingPanel
          creditId={selectedTransactionId}
          creditAmount={selectedTransaction.amount}
          creditDate={selectedTransaction.date}
          creditDescription={selectedTransaction.description}
          onClose={() => setIsPickerOpen(false)}
          onSelect={(candidate) => {
            handleToggleEvidence({
              id: candidate.transactionId,
              amount: candidate.amount,
              description: candidate.description,
              date: new Date(candidate.date),
              score: candidate.matchPercent,
            });
            setIsPickerOpen(false);
          }}
        />
      )}
      <CreateBeneficiaryModal
        isOpen={createModalOpen}
        beneficiaryType={
          mode === 'linked' ? linkedBeneficiaryType : manualBeneficiaryType
        }
        initialName={pendingBeneficiaryName}
        onClose={() => {
          setCreateModalOpen(false);
          setPendingBeneficiaryName('');
        }}
        onCreated={(id) => {
          if (mode === 'linked') {
            linkedForm.setValue('beneficiaryId', id, { shouldValidate: true });
          } else {
            manualForm.setValue('beneficiaryId', id, { shouldValidate: true });
          }
          setCreateModalOpen(false);
          setPendingBeneficiaryName('');
        }}
      />
    </>
  );
}
