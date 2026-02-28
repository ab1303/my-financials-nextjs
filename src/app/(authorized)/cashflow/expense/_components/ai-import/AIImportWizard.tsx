'use client';

import { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { FiX } from 'react-icons/fi';
import UploadStep from './UploadStep';
import ProcessingStep from './ProcessingStep';
import ResultsStep from './ResultsStep';
import type {
  AIImportWizardProps,
  WizardStep,
  UploadedFile,
  ImportSessionResult,
  ExpenseImportContext,
} from './_types';

export default function AIImportWizard({
  isOpen,
  onClose,
  calendarYearId,
  onImportComplete,
}: AIImportWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [importResult, setImportResult] = useState<ImportSessionResult | null>(
    null,
  );
  // Default to current month
  const month = new Date().getMonth() + 1;

  const context: ExpenseImportContext = {
    calendarYearId,
    month,
  };

  const handleFilesSelected = (newFiles: UploadedFile[]) => {
    setFiles(newFiles);
  };

  const handleRemoveFile = (fileId: string) => {
    setFiles(files.filter((f) => f.id !== fileId));
  };

  const handleStartImport = () => {
    setCurrentStep('processing');
  };

  const handleProcessingComplete = (result: ImportSessionResult) => {
    setImportResult(result);
    setCurrentStep('results');
  };

  const handleDone = () => {
    onClose();
    if (onImportComplete) {
      onImportComplete();
    }
    // Reset state for next import
    setCurrentStep('upload');
    setFiles([]);
    setImportResult(null);
  };

  const handleImportMore = () => {
    setCurrentStep('upload');
    setFiles([]);
    setImportResult(null);
  };

  return (
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
              <Dialog.Panel className='w-full max-w-2xl transform overflow-hidden rounded-lg bg-white shadow-xl transition-all'>
                {/* Header */}
                <div className='flex items-center justify-between border-b border-gray-200 p-6'>
                  <div>
                    <Dialog.Title className='text-lg font-semibold text-gray-900'>
                      AI Import Wizard
                    </Dialog.Title>
                    <p className='mt-1 text-sm text-gray-600'>
                      {currentStep === 'upload' && 'Step 1: Select Images'}
                      {currentStep === 'processing' && 'Step 2: Processing'}
                      {currentStep === 'results' && 'Step 3: Results'}
                    </p>
                  </div>
                  {currentStep !== 'processing' && (
                    <button
                      onClick={onClose}
                      className='text-gray-400 hover:text-gray-600 transition-colors'
                    >
                      <FiX className='h-6 w-6' />
                    </button>
                  )}
                </div>

                {/* Progress Indicator */}
                <div className='flex gaps-2 border-b border-gray-200 px-6 py-3'>
                  {['upload', 'processing', 'results'].map((step, index) => (
                    <div key={step} className='flex items-center'>
                      <div
                        className={`flex items-center justify-center h-8 w-8 rounded-full text-sm font-semibold ${
                          currentStep === step
                            ? 'bg-blue-600 text-white'
                            : ['upload', 'processing'].includes(currentStep) &&
                                index <
                                  ['upload', 'processing', 'results'].indexOf(
                                    currentStep,
                                  )
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {index + 1}
                      </div>
                      {index < 2 && (
                        <div
                          className={`h-1 mx-2 flex-1 ${
                            ['upload', 'processing', 'results'].indexOf(
                              currentStep,
                            ) > index
                              ? 'bg-green-600'
                              : 'bg-gray-200'
                          }`}
                          style={{ width: '40px' }}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* Content */}
                <div className='p-6'>
                  {currentStep === 'upload' && (
                    <UploadStep
                      files={files}
                      onFilesSelected={handleFilesSelected}
                      onRemoveFile={handleRemoveFile}
                      onStartImport={handleStartImport}
                      context={context}
                    />
                  )}

                  {currentStep === 'processing' && (
                    <ProcessingStep
                      files={files}
                      onComplete={handleProcessingComplete}
                      context={context}
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
  );
}
