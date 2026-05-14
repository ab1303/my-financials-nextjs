'use client';

import { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import UploadStep from './UploadStep';
import ProcessingStep from './ProcessingStep';
import ReviewStep from './ReviewStep';
import ResultsStep from './ResultsStep';
import Portal from '@/components/Portal';
import type {
  AIImportSessionResult,
  AIImportWizardProps,
  ExtractedImageResult,
  UploadedFile,
  WizardStep,
} from './_types';

export default function AIImportWizard({
  isOpen,
  onClose,
  bankAccounts,
  onImportComplete,
}: AIImportWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [importResult, setImportResult] = useState<AIImportSessionResult | null>(null);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | null>(null);
  const [extractedImages, setExtractedImages] = useState<ExtractedImageResult[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [calendarYearId, setCalendarYearId] = useState('');

  const currentMonth = new Date().getMonth() + 1;
  const steps: WizardStep[] = ['upload', 'processing', 'review', 'results'];
  const currentStepIndex = steps.indexOf(currentStep);

  const handleFilesSelected = (newFiles: UploadedFile[]) => {
    setFiles(newFiles);
  };

  const handleRemoveFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleStartImport = () => {
    setCurrentStep('processing');
  };

  const handleProcessingComplete = (
    newSessionId: string,
    images: ExtractedImageResult[],
  ) => {
    setSessionId(newSessionId);
    setExtractedImages(images);
    setCurrentStep('review');
  };

  const handleReviewConfirm = (result: AIImportSessionResult) => {
    setImportResult(result);
    setCurrentStep('results');
  };

  const handleDone = () => {
    onClose();
    onImportComplete?.();
    setCurrentStep('upload');
    setFiles([]);
    setImportResult(null);
    setSelectedBankAccountId(null);
    setExtractedImages([]);
    setSessionId(null);
    setCalendarYearId('');
  };

  const handleImportMore = () => {
    setCurrentStep('upload');
    setFiles([]);
    setImportResult(null);
    setSelectedBankAccountId(null);
    setExtractedImages([]);
    setSessionId(null);
    setCalendarYearId('');
  };

  return (
    // Portal renders the entire Headless UI dialog tree into a <div id="portal-root">
    // appended to <body>, completely outside this component's DOM ancestry.
    // This guarantees the overlay and panel are never clipped by ancestor
    // overflow:hidden / transform / filter stacking contexts.
    <Portal>
      <Transition show={isOpen}>
        <Dialog onClose={onClose} className='relative z-50'>
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

          <div className='fixed inset-0 overflow-y-auto'>
            <div className='flex min-h-full items-center justify-center p-4'>
              <Transition.Child
                enter='ease-out duration-300'
                enterFrom='opacity-0 scale-95'
                enterTo='opacity-100 scale-100'
                leave='ease-in duration-200'
                leaveFrom='opacity-100 scale-100'
                leaveTo='opacity-0 scale-95'
              >
                <Dialog.Panel className='w-full max-w-2xl transform overflow-hidden rounded-lg bg-card shadow-xl transition-all'>
                  <div className='flex items-center justify-between border-b border-border p-6'>
                    <div>
                      <Dialog.Title className='text-lg font-semibold text-foreground'>
                        AI Import Wizard
                      </Dialog.Title>
                      <p className='mt-1 text-sm text-muted-foreground'>
                        {currentStep === 'upload' && 'Step 1: Select Images'}
                        {currentStep === 'processing' && 'Step 2: Processing'}
                        {currentStep === 'review' && 'Step 3: Review'}
                        {currentStep === 'results' && 'Step 4: Results'}
                      </p>
                    </div>
                    {currentStep !== 'processing' && (
                      <button
                        onClick={onClose}
                        className='text-muted-foreground hover:text-muted-foreground transition-colors'
                      >
                        <X className='h-6 w-6' />
                      </button>
                    )}
                  </div>

                  <div className='flex gap-2 border-b border-border px-6 py-3'>
                    {steps.map((step, index) => (
                      <div key={step} className='flex items-center flex-1'>
                        <div
                          className={`flex items-center justify-center h-8 w-8 rounded-full text-sm font-semibold ${
                            currentStep === step
                              ? 'bg-blue-600 text-white'
                              : index < currentStepIndex
                                ? 'bg-green-600 text-white'
                                : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {index + 1}
                        </div>
                        {index < steps.length - 1 && (
                          <div
                            className={`h-1 mx-2 flex-1 ${
                              currentStepIndex > index
                                ? 'bg-green-600'
                                : 'bg-muted'
                            }`}
                            style={{ width: '40px' }}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className='p-6'>
                    {currentStep === 'upload' && (
                      <UploadStep
                        files={files}
                        onFilesSelected={handleFilesSelected}
                        onRemoveFile={handleRemoveFile}
                        onStartImport={handleStartImport}
                        bankAccounts={bankAccounts}
                        selectedBankAccountId={selectedBankAccountId}
                        onBankAccountChange={setSelectedBankAccountId}
                      />
                    )}

                    {currentStep === 'processing' && (
                      <ProcessingStep
                        files={files}
                        bankAccountId={selectedBankAccountId}
                        onComplete={handleProcessingComplete}
                        context={{ calendarYearId, month: currentMonth }}
                      />
                    )}

                    {currentStep === 'review' && sessionId && (
                      <ReviewStep
                        sessionId={sessionId}
                        extractedImages={extractedImages}
                        categories={[]}
                        calendarYearId={calendarYearId}
                        month={currentMonth}
                        bankAccountId={selectedBankAccountId ?? undefined}
                        onConfirm={handleReviewConfirm}
                        onBack={() => setCurrentStep('processing')}
                        isConfirming={false}
                      />
                    )}

                    {currentStep === 'results' && importResult && (
                      <ResultsStep
                        result={importResult}
                        onDone={handleDone}
                        onImportMore={handleImportMore}
                      />
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </Portal>
  );
}
