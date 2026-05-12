'use client';

import { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import CSVUploadStep from './CSVUploadStep';
import CSVProcessingStep from './CSVProcessingStep';
import CSVResultsStep from './CSVResultsStep';
import type {
  CSVImportWizardProps,
  CSVWizardStep,
  UploadedCSVFile,
  CSVImportResult,
  CSVImportContext,
} from './_types';

export default function CSVImportWizard({
  isOpen,
  onClose,
  calendarYearId,
  onImportComplete,
}: CSVImportWizardProps) {
  const [currentStep, setCurrentStep] = useState<CSVWizardStep>('upload');
  const [file, setFile] = useState<UploadedCSVFile | null>(null);
  const [importResult, setImportResult] = useState<CSVImportResult | null>(
    null,
  );

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
      setCurrentStep('processing');
    }
  };

  const handleProcessingComplete = (result: CSVImportResult) => {
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
    setFile(null);
    setImportResult(null);
  };

  const handleImportMore = () => {
    setCurrentStep('upload');
    setFile(null);
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
                      CSV Import Wizard
                    </Dialog.Title>
                    <p className='mt-1 text-sm text-gray-600'>
                      {currentStep === 'upload' && 'Step 1: Select CSV File'}
                      {currentStep === 'processing' && 'Step 2: Processing'}
                      {currentStep === 'results' && 'Step 3: Results'}
                    </p>
                  </div>
                  {currentStep !== 'processing' && (
                    <button
                      onClick={onClose}
                      className='text-gray-400 hover:text-gray-600 transition-colors'
                    >
                      <X className='h-6 w-6' />
                    </button>
                  )}
                </div>

                {/* Progress Indicator */}
                <div className='flex gap-2 border-b border-gray-200 px-6 py-3'>
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
                    <CSVUploadStep
                      file={file}
                      onFileSelected={handleFileSelected}
                      onRemoveFile={handleRemoveFile}
                      onStartImport={handleStartImport}
                      isLoading={false}
                    />
                  )}

                  {currentStep === 'processing' && file && (
                    <CSVProcessingStep
                      file={file}
                      onComplete={handleProcessingComplete}
                      context={context}
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
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
