'use client';

import { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import CSVUploadStep from './CSVUploadStep';
import CSVClassifyingStep from './CSVClassifyingStep';
import CSVResultsStep from './CSVResultsStep';
import TransactionReviewTable from '@/components/csv-import/TransactionReviewTable';
import type { ClassifiedMonth } from '@/components/csv-import/TransactionReviewTable';
import type {
  CSVImportWizardProps,
  CSVWizardStep,
  UploadedCSVFile,
  CSVImportResult,
  CSVImportContext,
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
  calendarYearId,
  onImportComplete,
}: CSVImportWizardProps) {
  const [currentStep, setCurrentStep] = useState<CSVWizardStep>('upload');
  const [file, setFile] = useState<UploadedCSVFile | null>(null);
  const [importResult, setImportResult] = useState<CSVImportResult | null>(null);
  const [classifiedMonths, setClassifiedMonths] = useState<ClassifiedMonth[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [llmModel, setLlmModel] = useState<string>('gpt-4o-mini');
  const [isConfirming, setIsConfirming] = useState(false);

  const context: CSVImportContext = {
    importType: 'EXPENSE',
    calendarYearId,
  };

  const handleFileSelected = (newFile: UploadedCSVFile) => {
    setFile(newFile);
  };

  const handleRemoveFile = () => {
    setFile(null);
  };

  const handleStartImport = () => {
    if (file) {
      setCurrentStep('classifying');
    }
  };

  const handleClassifyComplete = (
    months: ClassifiedMonth[],
    cats: Array<{ id: string; name: string }>,
    model: string,
  ) => {
    setClassifiedMonths(months);
    setCategories(cats);
    setLlmModel(model);
    setCurrentStep('review');
  };

  const handleClassifyError = (message: string) => {
    toast.error(`Classification failed: ${message}`);
    setCurrentStep('upload');
  };

  const handleConfirmReview = async (confirmedMonths: ClassifiedMonth[]) => {
    if (!file) return;
    setIsConfirming(true);

    const totalLlmUsage = confirmedMonths.reduce(
      (acc, m) => ({
        promptTokens: acc.promptTokens + (m.totalUsage?.promptTokens ?? 0),
        completionTokens: acc.completionTokens + (m.totalUsage?.completionTokens ?? 0),
        totalTokens: acc.totalTokens + (m.totalUsage?.totalTokens ?? 0),
      }),
      { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    );

    try {
      const res = await fetch('/api/csv-import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: file.id,
          calendarYearId,
          llmUsage: totalLlmUsage,
          months: confirmedMonths.map((m) => ({
            month: m.month,
            transactions: m.transactions,
          })),
        }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        savedMonths?: number;
        totalEntries?: number;
        status?: 'COMPLETED' | 'PARTIAL' | 'FAILED';
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error ?? 'Confirm request failed');
      }

      const result: CSVImportResult = {
        sessionId: file.id,
        status: data.status ?? 'COMPLETED',
        recordsCreated: data.totalEntries ?? 0,
        monthsProcessed: data.savedMonths ?? confirmedMonths.length,
        totalMonths: confirmedMonths.length,
        errors: [],
      };

      setImportResult(result);
      setCurrentStep('results');
      toast.success(`Imported ${data.totalEntries ?? 0} transactions successfully`);
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
    if (onImportComplete) {
      onImportComplete();
    }
  };

  const handleImportMore = () => {
    resetState();
  };

  function resetState() {
    setCurrentStep('upload');
    setFile(null);
    setImportResult(null);
    setClassifiedMonths([]);
    setCategories([]);
    setLlmModel('gpt-4o-mini');
    setIsConfirming(false);
  }

  const currentStepIndex = STEP_KEYS.indexOf(currentStep);
  // Never close on backdrop click — user may have unsaved overrides
  const canClose = currentStep !== 'classifying' && !isConfirming;

  const stepSubtitle: Record<CSVWizardStep, string> = {
    upload: 'Step 1: Select CSV File',
    classifying: 'Step 2: AI Classification',
    review: 'Step 3: Review & Confirm',
    results: 'Step 4: Results',
  };

  return (
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
              {/* Header — fixed */}
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

              {/* Progress Indicator — fixed */}
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

              {/* Content — review step manages its own internal scroll; other steps scroll here */}
              {currentStep === 'review' ? (
                <div className='flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-6 pt-4'>
                  <TransactionReviewTable
                    months={classifiedMonths}
                    categories={categories}
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
  );
}
