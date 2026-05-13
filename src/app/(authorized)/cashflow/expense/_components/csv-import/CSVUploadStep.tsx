'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CSVUploadStepProps, UploadedCSVFile } from './_types';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export default function CSVUploadStep({
  file,
  onFileSelected,
  onRemoveFile,
  onStartImport,
  isLoading = false,
}: CSVUploadStepProps) {
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const validateCSV = async (csvFile: File): Promise<UploadedCSVFile | null> => {
    setIsValidating(true);
    setValidationError(null);

    try {
      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append('file', csvFile);

      const response = await fetch('/api/csv-import/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage =
          errorData.error || 'Failed to validate CSV file';
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
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to validate CSV';
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

      // Validate file type
      if (!csvFile.type.includes('csv') && !csvFile.name.endsWith('.csv')) {
        setValidationError('Please upload a CSV file');
        return;
      }

      // Validate file size
      if (csvFile.size > MAX_FILE_SIZE) {
        setValidationError('File size exceeds 5MB limit');
        return;
      }

      await validateCSV(csvFile);
    },
    [onFileSelected],
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
      {/* Upload Area */}
      {!file ? (
        <>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 bg-gray-50 hover:border-gray-400'
            } ${isValidating ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input {...getInputProps()} />
            <Upload className='h-12 w-12 text-gray-400 mx-auto mb-4' />
            <h3 className='text-lg font-semibold text-gray-900 mb-1'>
              {isDragActive
                ? 'Drop your CSV file here'
                : 'Drop CSV file or click to select'}
            </h3>
            <p className='text-sm text-gray-600 mb-4'>
              Supports CommBank CSV format (Date, Amount, Description, Balance)
            </p>
            <p className='text-xs text-gray-500'>
              Maximum file size: 5MB | Maximum 1000 rows
            </p>
          </div>

          {validationError && (
            <div className='bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3'>
              <AlertCircle className='h-5 w-5 text-red-600 flex-shrink-0 mt-0.5' />
              <div>
                <h4 className='text-sm font-semibold text-red-900'>
                  Validation Error
                </h4>
                <p className='text-sm text-red-800 mt-1'>{validationError}</p>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* File Preview */}
          <div className='bg-gray-50 border border-gray-200 rounded-lg p-4'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-semibold text-gray-900'>
                  {file.fileName}
                </p>
                <p className='text-xs text-gray-600 mt-1'>
                  {file.rowCount} rows | {(file.fileSize / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                onClick={onRemoveFile}
                disabled={isLoading}
                className='text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50'
                aria-label='Remove file'
              >
                <X className='h-5 w-5' />
              </button>
            </div>

            {/* Transaction Preview */}
            {file.transactions && file.transactions.length > 0 && (
              <div className='mt-4 pt-4 border-t border-gray-200'>
                <p className='text-xs font-medium text-gray-700 mb-2'>
                  Preview ({Math.min(3, file.transactions.length)} of{' '}
                  {file.transactions.length})
                </p>
                <div className='space-y-2'>
                  {file.transactions.slice(0, 3).map((tx, idx) => (
                    <div
                      key={idx}
                      className='text-xs text-gray-600 bg-white p-2 rounded border border-gray-100'
                    >
                      <div className='flex justify-between'>
                        <span>{tx.description}</span>
                        <span className='font-medium'>${tx.amount.toFixed(2)}</span>
                      </div>
                      <div className='text-gray-500 mt-1'>
                        {tx.date}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className='flex gap-3 justify-between'>
            <Button
              variant='outline'
              onClick={onRemoveFile}
              disabled={isLoading}
            >
              Choose Different File
            </Button>
            <Button
              variant='default'
              onClick={onStartImport}
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : 'Import CSV'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
