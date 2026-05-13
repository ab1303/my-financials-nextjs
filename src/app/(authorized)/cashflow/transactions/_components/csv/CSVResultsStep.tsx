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
      description: `${result.totalEntries} entries imported successfully`,
    },
    PARTIAL: {
      icon: AlertCircle,
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-900',
      label: 'Import Completed with Errors',
      description: `${result.totalEntries} entries imported, but some items had errors`,
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
      <div className={`${config.bgColor} border ${config.borderColor} flex items-start space-x-3 rounded-lg p-4`}>
        <Icon className='mt-0.5 h-5 w-5 flex-shrink-0 text-current' />
        <div>
          <h3 className={`text-sm font-semibold ${config.textColor}`}>{config.label}</h3>
          <p className={`mt-1 text-sm ${config.textColor.replace('900', '800')}`}>{config.description}</p>
        </div>
      </div>

      <div className='space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4'>
        <div className='flex items-center justify-between'>
          <span className='text-sm font-medium text-gray-700'>Expenses Saved</span>
          <span className='text-lg font-bold text-gray-900'>{result.debitsSaved}</span>
        </div>
        <div className='flex items-center justify-between'>
          <span className='text-sm font-medium text-gray-700'>Income Records Saved</span>
          <span className='text-lg font-bold text-gray-900'>{result.creditsSaved}</span>
        </div>
        {result.creditsExcluded > 0 && (
          <div className='flex items-center justify-between'>
            <span className='text-sm font-medium text-gray-700'>Transfers/Excluded</span>
            <span className='text-lg font-bold text-gray-400'>{result.creditsExcluded}</span>
          </div>
        )}
        <div className='flex items-center justify-between pt-3 border-t border-gray-200'>
          <span className='text-sm font-medium text-gray-700'>Total Entries</span>
          <span className='text-lg font-bold text-gray-900'>{result.totalEntries}</span>
        </div>
      </div>

      {result.errors.length > 0 && (
        <div className='rounded-lg border border-red-200 bg-red-50 p-4'>
          <h4 className='mb-3 text-sm font-semibold text-red-900'>Errors Encountered</h4>
          <div className='space-y-2'>
            {result.errors.map((error, idx) => (
              <div key={idx} className='rounded border border-red-100 bg-white p-2 text-xs text-red-800'>
                <div className='font-medium'>Month {error.month}</div>
                <div className='mt-1 text-red-700'>{error.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className='rounded-lg border border-gray-200 bg-gray-50 p-4'>
        <h4 className='mb-2 text-sm font-semibold text-gray-900'>File Summary</h4>
        <div className='space-y-1 text-xs text-gray-600'>
          <div className='flex justify-between'>
            <span>File Name:</span>
            <span className='font-medium text-gray-900'>{file.fileName}</span>
          </div>
          <div className='flex justify-between'>
            <span>File Size:</span>
            <span className='font-medium text-gray-900'>{(file.fileSize / 1024).toFixed(1)} KB</span>
          </div>
          <div className='flex justify-between'>
            <span>Total Rows:</span>
            <span className='font-medium text-gray-900'>{file.rowCount}</span>
          </div>
          <div className='flex justify-between'>
            <span>Session ID:</span>
            <span className='truncate font-mono text-xs text-gray-900'>{result.sessionId}</span>
          </div>
        </div>
      </div>

      <div className='flex justify-between gap-3'>
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
