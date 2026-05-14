'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CSVUploadStepProps, UploadedCSVFile } from './_types';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function CSVUploadStep({
  file,
  onFileSelected,
  onRemoveFile,
  onStartImport,
  isLoading = false,
  bankAccounts,
  selectedBankAccountId,
  onBankAccountChange,
}: CSVUploadStepProps) {
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const validateCSV = async (csvFile: File): Promise<UploadedCSVFile | null> => {
    if (!selectedBankAccountId) {
      setValidationError('Please select a bank account before uploading.');
      return null;
    }

    setIsValidating(true);
    setValidationError(null);

    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      formData.append('bankAccountId', selectedBankAccountId ?? '');

      const response = await fetch('/api/transactions/csv/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to validate CSV file';
        setValidationError(errorMessage);
        setIsValidating(false);
        return null;
      }

      const uploadResponse = await response.json();

      const uploadedFile: UploadedCSVFile = {
        id: uploadResponse.fileId,
        file: csvFile,
        fileName: uploadResponse.fileName,
        fileSize: uploadResponse.fileSize,
        rowCount: uploadResponse.rowCount,
        status: 'valid',
        transactions: uploadResponse.transactions,
      };

      onFileSelected(uploadedFile);
      setIsValidating(false);
      return uploadedFile;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to validate CSV';
      setValidationError(errorMessage);
      setIsValidating(false);
      return null;
    }
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const csvFile = acceptedFiles[0];
      if (!csvFile) return;

      if (!csvFile.type.includes('csv') && !csvFile.name.endsWith('.csv')) {
        setValidationError('Please upload a CSV file');
        return;
      }

      if (csvFile.size > MAX_FILE_SIZE) {
        setValidationError('File size exceeds 5MB limit');
        return;
      }

      await validateCSV(csvFile);
    },
    [selectedBankAccountId],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'text/plain': ['.csv'],
    },
    multiple: false,
    disabled: isValidating || isLoading,
  });

  return (
    <div className='space-y-6'>
      <div className='space-y-2 mb-6'>
        <label className='text-sm font-medium text-foreground'>
          Bank Account <span className='text-red-500'>*</span>
        </label>
        <select
          value={selectedBankAccountId ?? ''}
          onChange={(e) => onBankAccountChange(e.target.value)}
          className='w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring dark:bg-gray-800 dark:text-white dark:border-gray-600'
          required
        >
          <option value=''>Select a bank account</option>
          {bankAccounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.bankName} — {acc.name}
            </option>
          ))}
        </select>
      </div>

      {!file ? (
        <>
          <div
            {...getRootProps()}
            className={`cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
              isDragActive
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 bg-gray-50 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500'
            } ${isValidating ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            <input {...getInputProps()} />
            <Upload className='mx-auto mb-4 h-12 w-12 text-gray-400 dark:text-gray-500' />
            <h3 className='mb-1 text-lg font-semibold text-gray-900 dark:text-white'>
              {isDragActive ? 'Drop your CSV file here' : 'Drop CSV file or click to select'}
            </h3>
            <p className='mb-4 text-sm text-gray-600 dark:text-gray-400'>
              Supports CommBank CSV format (Date, Amount, Description, Balance)
            </p>
            <p className='text-xs text-gray-500 dark:text-gray-400'>
              Maximum file size: 5MB | Maximum 1000 rows
            </p>
          </div>

          {validationError && (
            <div className='flex items-start space-x-3 rounded-lg border border-red-200 bg-red-50 p-4'>
              <AlertCircle className='mt-0.5 h-5 w-5 flex-shrink-0 text-red-600' />
              <div>
                <h4 className='text-sm font-semibold text-red-900'>Validation Error</h4>
                <p className='mt-1 text-sm text-red-800'>{validationError}</p>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className='rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-semibold text-gray-900 dark:text-white'>{file.fileName}</p>
                <p className='mt-1 text-xs text-gray-600 dark:text-gray-400'>
                  {file.rowCount} rows | {(file.fileSize / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                onClick={onRemoveFile}
                disabled={isLoading}
                className='text-gray-400 transition-colors hover:text-gray-600 disabled:opacity-50'
                aria-label='Remove file'
              >
                <X className='h-5 w-5' />
              </button>
            </div>

            {file.transactions && file.transactions.length > 0 && (
              <div className='mt-4 border-t border-gray-200 dark:border-gray-700 pt-4'>
                <p className='mb-2 text-xs font-medium text-gray-700 dark:text-gray-300'>
                  Preview ({Math.min(3, file.transactions.length)} of {file.transactions.length})
                </p>
                <div className='space-y-2'>
                  {file.transactions.slice(0, 3).map((tx, idx) => (
                    <div key={idx} className='rounded border border-gray-100 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-xs text-gray-600 dark:text-gray-300'>
                      <div className='flex justify-between'>
                        <span>{tx.description}</span>
                        <span className='font-medium'>${tx.amount.toFixed(2)}</span>
                      </div>
                      <div className='mt-1 text-gray-500 dark:text-gray-400'>{tx.date}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className='flex justify-between gap-3'>
            <Button variant='outline' onClick={onRemoveFile} disabled={isLoading}>
              Choose Different File
            </Button>
            <Button variant='default' onClick={onStartImport} disabled={isLoading || !selectedBankAccountId || !file}>
              {isLoading ? 'Processing...' : 'Import CSV'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
