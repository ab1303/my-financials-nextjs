'use client';

import { FiCheck, FiX, FiAlertCircle } from 'react-icons/fi';
import ConfidenceBadge from './ConfidenceBadge';
import type { ResultsStepProps } from './_types';

export default function ResultsStep({
  result,
  onDone,
  onImportMore,
}: ResultsStepProps) {
  const failedCount = result.images.filter(
    (img) => img.status === 'failed',
  ).length;
  const allImages = result.images;

  return (
    <div className='space-y-6'>
      {/* Success Banner */}
      <div className='bg-green-50 border border-green-200 rounded-lg p-4 flex items-start space-x-3'>
        <FiCheck className='h-5 w-5 text-green-600 flex-shrink-0 mt-0.5' />
        <div>
          <h3 className='text-sm font-semibold text-green-900'>
            Import Complete
          </h3>
          <p className='text-sm text-green-800 mt-1'>
            {result.recordsCreated} entries successfully created from{' '}
            {result.images.length} image{result.images.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className='bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3'>
        <div className='flex items-center justify-between'>
          <span className='text-sm font-medium text-gray-700'>
            Entries Created
          </span>
          <span className='text-lg font-bold text-gray-900'>
            {result.recordsCreated}
          </span>
        </div>
        <div className='flex items-center justify-between pt-3 border-t border-gray-200'>
          <span className='text-sm font-medium text-gray-700'>
            Overall Confidence
          </span>
          <ConfidenceBadge score={result.overallConfidence} />
        </div>

        {failedCount > 0 && (
          <div className='flex items-center justify-between pt-3 border-t border-gray-200'>
            <span className='text-sm font-medium text-gray-700'>
              Failed Images
            </span>
            <span className='text-sm font-semibold text-red-600'>
              {failedCount}
            </span>
          </div>
        )}
      </div>

      {/* Low Confidence Warning */}
      {result.overallConfidence < 0.6 && (
        <div className='bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start space-x-3'>
          <FiAlertCircle className='h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5' />
          <div>
            <h4 className='text-sm font-semibold text-yellow-900'>
              Low Confidence Warning
            </h4>
            <p className='text-sm text-yellow-800 mt-1'>
              Some extracted values may be inaccurate. We recommend reviewing
              the imported records before finalizing.
            </p>
          </div>
        </div>
      )}

      {/* Per-Image Results */}
      {allImages.length > 0 && (
        <div className='space-y-3'>
          <h4 className='text-sm font-semibold text-gray-900'>Image Details</h4>
          <div className='space-y-2 max-h-64 overflow-y-auto'>
            {allImages.map((image) => (
              <div
                key={image.imageId}
                className='flex items-start space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm'
              >
                <div className='flex-shrink-0 mt-0.5'>
                  {image.status === 'success' && (
                    <FiCheck className='h-4 w-4 text-green-600' />
                  )}
                  {image.status === 'partial' && (
                    <FiAlertCircle className='h-4 w-4 text-yellow-600' />
                  )}
                  {image.status === 'failed' && (
                    <FiX className='h-4 w-4 text-red-600' />
                  )}
                </div>
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center justify-between'>
                    <p className='font-medium text-gray-900 truncate'>
                      {image.fileName}
                    </p>
                    {image.confidence !== undefined && (
                      <span className='text-xs font-semibold text-gray-600'>
                        {Math.round(image.confidence * 100)}%
                      </span>
                    )}
                  </div>
                  {image.status === 'success' &&
                    image.entriesCreated !== undefined && (
                      <p className='text-xs text-gray-600 mt-1'>
                        Created {image.entriesCreated} entries
                      </p>
                    )}
                  {image.status === 'failed' && image.errorMessage && (
                    <p className='text-xs text-red-600 mt-1'>
                      {image.errorMessage}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
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
