'use client';

import { Check, AlertCircle, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import PostImportMatchBanner from '../transfer/PostImportMatchBanner';
import type { CSVResultsStepProps } from './_types';

export default function CSVResultsStep({
  result,
  file,
  onDone,
  onImportMore,
  matchJobSummary,
}: CSVResultsStepProps) {
  const [bannerDismissed, setBannerDismissed] = useState(false);
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
      {!bannerDismissed &&
        (matchJobSummary?.autoLinkedCount ?? 0) + (matchJobSummary?.flaggedCount ?? 0) > 0 && (
          <PostImportMatchBanner
            importSessionId={result.sessionId}
            autoLinkedCount={matchJobSummary?.autoLinkedCount ?? 0}
            flaggedCount={matchJobSummary?.flaggedCount ?? 0}
            onDismiss={() => setBannerDismissed(true)}
          />
        )}
      <div className={`${config.bgColor} border ${config.borderColor} flex items-start space-x-3 rounded-lg p-4`}>
        <Icon className='mt-0.5 h-5 w-5 flex-shrink-0 text-current' />
        <div>
          <h3 className={`text-sm font-semibold ${config.textColor}`}>{config.label}</h3>
          <p className={`mt-1 text-sm ${config.textColor.replace('900', '800')}`}>{config.description}</p>
        </div>
      </div>

      <div className='space-y-3 rounded-lg border border-border bg-muted p-4'>
        <div className='flex items-center justify-between'>
          <span className='text-sm font-medium text-foreground'>Expenses Saved</span>
          <span className='text-lg font-bold text-foreground'>{result.debitsSaved}</span>
        </div>
        <div className='flex items-center justify-between'>
          <span className='text-sm font-medium text-foreground'>Income Records Saved</span>
          <span className='text-lg font-bold text-foreground'>{result.creditsSaved}</span>
        </div>
        {result.creditsExcluded > 0 && (
          <div className='flex items-center justify-between'>
            <span className='text-sm font-medium text-foreground'>Transfers/Excluded</span>
            <span className='text-lg font-bold text-muted-foreground'>{result.creditsExcluded}</span>
          </div>
        )}
        {result.duplicatesSkipped > 0 && (
          <div className='flex items-center justify-between'>
            <span className='text-sm font-medium text-foreground'>Duplicates Skipped</span>
            <span className='text-lg font-bold text-muted-foreground'>{result.duplicatesSkipped}</span>
          </div>
        )}
        <div className='flex items-center justify-between pt-3 border-t border-border'>
          <span className='text-sm font-medium text-foreground'>Total Entries</span>
          <span className='text-lg font-bold text-foreground'>{result.totalEntries}</span>
        </div>
      </div>

      {result.errors.length > 0 && (
        <div className='rounded-lg border border-red-200 bg-red-50 p-4'>
          <h4 className='mb-3 text-sm font-semibold text-red-900'>Errors Encountered</h4>
          <div className='space-y-2'>
            {result.errors.map((error, idx) => (
              <div key={idx} className='rounded border border-red-200 bg-red-50/50 p-2 text-xs text-red-800 dark:text-red-300'>
                <div className='font-medium'>Month {error.month}</div>
                <div className='mt-1 text-red-700'>{error.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className='rounded-lg border border-border bg-muted p-4'>
        <h4 className='mb-2 text-sm font-semibold text-foreground'>File Summary</h4>
        <div className='space-y-1 text-xs text-muted-foreground'>
          <div className='flex justify-between'>
            <span>File Name:</span>
            <span className='font-medium text-foreground'>{file.fileName}</span>
          </div>
          <div className='flex justify-between'>
            <span>File Size:</span>
            <span className='font-medium text-foreground'>{(file.fileSize / 1024).toFixed(1)} KB</span>
          </div>
          <div className='flex justify-between'>
            <span>Total Rows:</span>
            <span className='font-medium text-foreground'>{file.rowCount}</span>
          </div>
          <div className='flex justify-between'>
            <span>Session ID:</span>
            <span className='truncate font-mono text-xs text-foreground'>{result.sessionId}</span>
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
