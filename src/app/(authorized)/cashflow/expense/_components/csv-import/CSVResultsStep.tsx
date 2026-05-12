'use client';

import { Check, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CSVResultsStepProps } from './_types';

export default function CSVResultsStep({
  result,
  file,
  onDone,
  onImportMore,
}: CSVResultsStepProps) {
  const statusConfig = {
    COMPLETED: {
      icon: Check,
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-900',
      label: 'Import Completed Successfully',
      description: `${result.recordsCreated} records imported from ${result.monthsProcessed} months`,
    },
    PARTIAL: {
      icon: AlertCircle,
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-900',
      label: 'Import Completed with Errors',
      description: `${result.recordsCreated} records imported, but some months had errors`,
    },
    FAILED: {
      icon: X,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-900',
      label: 'Import Failed',
      description: 'Failed to process the CSV file',
    },
  };

  const config = statusConfig[result.status];
  const Icon = config.icon;

  return (
    <div className='space-y-6'>
      {/* Status Banner */}
      <div
        className={`${config.bgColor} border ${config.borderColor} rounded-lg p-4 flex items-start space-x-3`}
      >
        <Icon className={`h-5 w-5 ${config.textColor.replace('text-', 'text-').replace('900', '600')} flex-shrink-0 mt-0.5`} />
        <div>
          <h3 className={`text-sm font-semibold ${config.textColor}`}>
            {config.label}
          </h3>
          <p className={`text-sm ${config.textColor.replace('900', '800')} mt-1`}>
            {config.description}
          </p>
        </div>
      </div>

      {/* Statistics */}
      <div className='bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3'>
        <div className='flex items-center justify-between'>
          <span className='text-sm font-medium text-gray-700'>
            Records Created
          </span>
          <span className='text-lg font-bold text-gray-900'>
            {result.recordsCreated}
          </span>
        </div>
        <div className='flex items-center justify-between pt-3 border-t border-gray-200'>
          <span className='text-sm font-medium text-gray-700'>
            Months Processed
          </span>
          <span className='text-lg font-bold text-gray-900'>
            {result.monthsProcessed} of {result.totalMonths}
          </span>
        </div>

        {result.errors.length > 0 && (
          <div className='flex items-center justify-between pt-3 border-t border-gray-200'>
            <span className='text-sm font-medium text-gray-700'>
              Errors
            </span>
            <span className='text-sm font-semibold text-red-600'>
              {result.errors.length} month{result.errors.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Error Details */}
      {result.errors.length > 0 && (
        <div className='bg-red-50 border border-red-200 rounded-lg p-4'>
          <h4 className='text-sm font-semibold text-red-900 mb-3'>
            Errors Encountered
          </h4>
          <div className='space-y-2'>
            {result.errors.map((error, idx) => (
              <div
                key={idx}
                className='text-xs text-red-800 bg-white p-2 rounded border border-red-100'
              >
                <div className='font-medium'>
                  Month {String(error.month).padStart(2, '0')}
                </div>
                <div className='text-red-700 mt-1'>{error.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* File Summary */}
      <div className='bg-gray-50 border border-gray-200 rounded-lg p-4'>
        <h4 className='text-sm font-semibold text-gray-900 mb-2'>
          File Summary
        </h4>
        <div className='text-xs text-gray-600 space-y-1'>
          <div className='flex justify-between'>
            <span>File Name:</span>
            <span className='font-medium text-gray-900'>{file.fileName}</span>
          </div>
          <div className='flex justify-between'>
            <span>File Size:</span>
            <span className='font-medium text-gray-900'>
              {(file.fileSize / 1024).toFixed(1)} KB
            </span>
          </div>
          <div className='flex justify-between'>
            <span>Total Rows:</span>
            <span className='font-medium text-gray-900'>{file.rowCount}</span>
          </div>
          <div className='flex justify-between'>
            <span>Session ID:</span>
            <span className='font-mono text-gray-900 text-xs truncate'>
              {result.sessionId}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className='flex gap-3 justify-between'>
        <Button variant='outline' onClick={onImportMore}>
          Import Another File
        </Button>
        <Button variant='default' onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
