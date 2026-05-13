'use client';

import { Check, AlertCircle } from 'lucide-react';
import type { AIImportSessionResult } from './_types';

interface ResultsStepProps {
  result: AIImportSessionResult;
  onDone: () => void;
  onImportMore: () => void;
}

export default function ResultsStep({
  result,
  onDone,
  onImportMore,
}: ResultsStepProps) {
  return (
    <div className='space-y-6'>
      <div className='bg-green-50 border border-green-200 rounded-lg p-4 flex items-start space-x-3'>
        <Check className='h-5 w-5 text-green-600 flex-shrink-0 mt-0.5' />
        <div>
          <h3 className='text-sm font-semibold text-green-900'>
            Import Complete
          </h3>
          <p className='text-sm text-green-800 mt-1'>
            {result.recordsCreated} entries created • {result.status}
          </p>
        </div>
      </div>

      <div className='bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3'>
        <div className='flex items-center justify-between'>
          <span className='text-sm font-medium text-gray-700'>Entries Created</span>
          <span className='text-lg font-bold text-gray-900'>
            {result.recordsCreated}
          </span>
        </div>
        <div className='flex items-center justify-between pt-3 border-t border-gray-200'>
          <span className='text-sm font-medium text-gray-700'>Status</span>
          <span className='text-sm font-semibold text-gray-900'>
            {result.status}
          </span>
        </div>
      </div>

      {result.status === 'FAILED' && (
        <div className='bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start space-x-3'>
          <AlertCircle className='h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5' />
          <div>
            <h4 className='text-sm font-semibold text-yellow-900'>
              Partial/Failed Import
            </h4>
            <p className='text-sm text-yellow-800 mt-1'>
              Some records may need manual review.
            </p>
          </div>
        </div>
      )}

      <div className='flex gap-3 pt-4 border-t border-gray-200'>
        <button
          onClick={onDone}
          className='flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors'
        >
          Done
        </button>
        <button
          onClick={onImportMore}
          className='flex-1 py-2.5 px-4 bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium rounded-lg transition-colors'
        >
          Import More
        </button>
      </div>
    </div>
  );
}
