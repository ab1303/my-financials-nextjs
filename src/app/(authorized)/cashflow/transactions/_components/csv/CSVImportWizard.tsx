'use client';

import { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import Portal from '@/components/Portal';
import CSVUploadStep from './CSVUploadStep';
import CSVClassifyingStep from './CSVClassifyingStep';
import CSVResultsStep from './CSVResultsStep';
import CSVTransactionReviewTable from './CSVTransactionReviewTable';
import type { ClassifiedMonth } from '@/components/csv-import/TransactionReviewTable';
import type {
  CSVImportWizardProps,
  CSVWizardStep,
  UploadedCSVFile,
  CSVImportResult,
  CSVImportContext,
  ClassifiedCreditMonth,
} from './_types';

const STEPS: { key: CSVWizardStep; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'classifying', label: 'Classify' },
  { key: 'review', label: 'Review' },
  { key: 'results', label: 'Done' },
];

const STEP_KEYS = STEPS.map((s) => s.key);

export default function CSVImportWizard({
  isOpen,
  onClose,
  bankAccounts,
  onImportComplete,
}: CSVImportWizardProps) {
  const [currentStep, setCurrentStep] = useState<CSVWizardStep>('upload');
  const [file, setFile] = useState<UploadedCSVFile | null>(null);
  const [importResult, setImportResult] = useState<CSVImportResult | null>(null);
  const [classifiedMonths, setClassifiedMonths] = useState<ClassifiedMonth[]>([]);
  const [classifiedCreditMonths, setClassifiedCreditMonths] = useState<ClassifiedCreditMonth[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [incomeSourceLabels, setIncomeSourceLabels] = useState<string[]>([]);
  const [llmModel, setLlmModel] = useState<string>('gpt-4o-mini');
  const [bankAccountId, setBankAccountId] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const context: CSVImportContext = {
    importType: 'EXPENSE',
    bankAccountId: bankAccountId ?? '',
  };

  const handleFileSelected = (newFile: UploadedCSVFile) => {
    setFile(newFile);
  };

  const handleRemoveFile = () => {
    setFile(null);
  };

  const handleStartImport = () => {
    if (file && bankAccountId) {
      setCurrentStep('classifying');
      return;
    }

    toast.error('Please select a bank account before importing.');
  };

  const handleClassifyComplete = (
    debitMonths: ClassifiedMonth[],
    creditMonths: ClassifiedCreditMonth[],
    cats: Array<{ id: string; name: string }>,
    incomeSrcLabels: string[],
    model: string,
  ) => {
    setClassifiedMonths(debitMonths);
    setClassifiedCreditMonths(creditMonths);
    setCategories(cats);
    setIncomeSourceLabels(incomeSrcLabels);
    setLlmModel(model);
    setCurrentStep('review');
  };

  const handleClassifyError = (message: string) => {
    toast.error(`Classification failed: ${message}`);
    setCurrentStep('upload');
  };

  const handleConfirmReview = async (
    confirmedDebitMonths: ClassifiedMonth[],
    confirmedCreditMonths: ClassifiedCreditMonth[],
  ) => {
    if (!file || !bankAccountId) return;
    setIsConfirming(true);

    const totalLlmUsage = [...confirmedDebitMonths, ...confirmedCreditMonths].reduce(
      (acc, month) => ({
        promptTokens: acc.promptTokens + (month.totalUsage?.promptTokens ?? 0),
        completionTokens: acc.completionTokens + (month.totalUsage?.completionTokens ?? 0),
        totalTokens: acc.totalTokens + (month.totalUsage?.totalTokens ?? 0),
      }),
      { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    );

    try {
      const res = await fetch('/api/transactions/csv/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: file.id,
          bankAccountId,
          llmUsage: totalLlmUsage,
          debitMonths: confirmedDebitMonths,
          creditMonths: confirmedCreditMonths,
        }),
      });

      const data = (await res.json()) as Partial<CSVImportResult> & { error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? 'Confirm request failed');
      }

      const debitsSaved = data.debitsSaved ?? confirmedDebitMonths.reduce((sum, month) => sum + month.transactions.length, 0);
      const creditsSaved =
        data.creditsSaved ??
        confirmedCreditMonths.reduce(
          (sum, month) =>
            sum + month.transactions.filter((tx) => tx.confirmedCategory !== 'Transfer' && tx.confirmedCategory !== 'Excluded').length,
          0,
        );
      const creditsExcluded =
        data.creditsExcluded ??
        confirmedCreditMonths.reduce(
          (sum, month) =>
            sum + month.transactions.filter((tx) => tx.confirmedCategory === 'Transfer' || tx.confirmedCategory === 'Excluded').length,
          0,
        );

      const result: CSVImportResult = {
        sessionId: data.sessionId ?? file.id,
        status: data.status ?? 'COMPLETED',
        debitsSaved,
        creditsSaved,
        creditsExcluded,
        totalEntries: data.totalEntries ?? debitsSaved + creditsSaved + creditsExcluded,
        errors: data.errors ?? [],
      };

      setImportResult(result);
      setCurrentStep('results');
      toast.success(`Imported ${result.totalEntries} entries successfully`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save transactions';
      toast.error(message);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleDone = () => {
    resetState();
    onClose();
    onImportComplete?.();
  };

  const handleImportMore = () => {
    resetState();
  };

  function resetState() {
    setCurrentStep('upload');
    setFile(null);
    setImportResult(null);
    setClassifiedMonths([]);
    setClassifiedCreditMonths([]);
    setCategories([]);
    setIncomeSourceLabels([]);
    setLlmModel('gpt-4o-mini');
    setBankAccountId(null);
    setIsConfirming(false);
  }

  const currentStepIndex = STEP_KEYS.indexOf(currentStep);
  const canClose = currentStep !== 'classifying' && !isConfirming;

  const stepSubtitle: Record<CSVWizardStep, string> = {
    upload: 'Step 1: Select CSV File',
    classifying: 'Step 2: AI Classification',
    review: 'Step 3: Review & Confirm',
    results: 'Step 4: Results',
  };

  return (
    // Portal renders the entire Headless UI dialog tree into a <div id="portal-root">
    // appended to <body>, completely outside this component's DOM ancestry.
    // This guarantees the overlay and panel are never clipped by ancestor
    // overflow:hidden / transform / filter stacking contexts.
    <Portal>
      <Transition show={isOpen}>
        <Dialog onClose={() => undefined} className='relative z-50'>
          <Transition.Child
            enter='ease-out duration-300'
            enterFrom='opacity-0'
            enterTo='opacity-100'
            leave='ease-in duration-200'
            leaveFrom='opacity-100'
            leaveTo='opacity-0'
          >
            <div className='fixed inset-0 bg-black/50' />
          </Transition.Child>

          <div className='fixed inset-0 flex items-center justify-center p-4'>
            <Transition.Child
              enter='ease-out duration-300'
              enterFrom='opacity-0 scale-95'
              enterTo='opacity-100 scale-100'
              leave='ease-in duration-200'
              leaveFrom='opacity-100 scale-100'
              leaveTo='opacity-0 scale-95'
            >
              <div className='w-full max-w-5xl'>
                <Dialog.Panel className='flex max-h-[90vh] w-full flex-col overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-900'>
                  <div className='flex flex-shrink-0 items-center justify-between border-b border-gray-200 p-6 dark:border-gray-700'>
                    <div>
                      <Dialog.Title className='text-lg font-semibold text-gray-900 dark:text-white'>
                        CSV Import Wizard
                      </Dialog.Title>
                      <p className='mt-1 text-sm text-gray-600 dark:text-gray-400'>
                        {stepSubtitle[currentStep]}
                      </p>
                    </div>
                    {canClose && (
                      <button
                        onClick={handleClose}
                        className='text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
                        aria-label='Close wizard'
                      >
                        <X className='h-6 w-6' />
                      </button>
                    )}
                  </div>

                  <div className='flex flex-shrink-0 items-center gap-1 border-b border-gray-200 px-6 py-3 dark:border-gray-700'>
                    {STEPS.map((step, index) => (
                      <div key={step.key} className='flex items-center'>
                        <div className='flex flex-col items-center'>
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                              currentStep === step.key
                                ? 'bg-teal-600 text-white'
                                : currentStepIndex > index
                                  ? 'bg-green-600 text-white'
                                  : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                            }`}
                          >
                            {currentStepIndex > index ? '✓' : index + 1}
                          </div>
                          <span className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                            {step.label}
                          </span>
                        </div>
                        {index < STEPS.length - 1 && (
                          <div
                            className={`mx-2 mb-4 h-1 w-10 ${
                              currentStepIndex > index
                                ? 'bg-green-600'
                                : 'bg-gray-200 dark:bg-gray-700'
                            }`}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  {currentStep === 'review' ? (
                    <div className='flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-6 pt-4'>
                      <CSVTransactionReviewTable
                        debitMonths={classifiedMonths}
                        creditMonths={classifiedCreditMonths}
                        categories={categories}
                        incomeSourceLabels={incomeSourceLabels}
                        llmModel={llmModel}
                        onConfirm={handleConfirmReview}
                        isConfirming={isConfirming}
                      />
                    </div>
                  ) : (
                    <div className='flex-1 overflow-y-auto p-6'>
                      {currentStep === 'upload' && (
                        <CSVUploadStep
                          file={file}
                          onFileSelected={handleFileSelected}
                          onRemoveFile={handleRemoveFile}
                          onStartImport={handleStartImport}
                          isLoading={false}
                          bankAccounts={bankAccounts}
                          selectedBankAccountId={bankAccountId}
                          onBankAccountChange={setBankAccountId}
                        />
                      )}

                      {currentStep === 'classifying' && file && (
                        <CSVClassifyingStep
                          file={file}
                          context={context}
                          onComplete={handleClassifyComplete}
                          onError={handleClassifyError}
                        />
                      )}

                      {currentStep === 'results' && importResult && file && (
                        <CSVResultsStep
                          result={importResult}
                          file={file}
                          onDone={handleDone}
                          onImportMore={handleImportMore}
                        />
                      )}
                    </div>
                  )}
                </Dialog.Panel>
              </div>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </Portal>
  );
}
