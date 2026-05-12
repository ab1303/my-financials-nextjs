'use client';

import { useEffect, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import type { CSVProcessingStepProps, CSVImportResult } from './_types';

export default function CSVProcessingStep({
  file,
  onComplete,
  context,
}: CSVProcessingStepProps) {
  const [progress, setProgress] = useState<{
    monthsProcessed: number;
    totalMonths: number;
    message: string;
  }>({
    monthsProcessed: 0,
    totalMonths: 0,
    message: 'Starting import...',
  });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CSVImportResult | null>(null);

  useEffect(() => {
    const processCSV = async () => {
      try {
        const parseRequest = {
          fileId: file.id,
          importType: context.importType,
          context: {
            calendarId: context.calendarYearId,
          },
        };

        const parseResponse = await fetch('/api/csv-import/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parseRequest),
        });

        if (!parseResponse.ok) {
          const errorData = await parseResponse.json();
          throw new Error(
            errorData.error || 'Failed to start CSV import',
          );
        }

        if (!parseResponse.body) {
          throw new Error('No response body');
        }

        // Handle SSE stream
        const reader = parseResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6);
              try {
                const event = JSON.parse(jsonStr);

                if (event.type === 'progress') {
                  setProgress({
                    monthsProcessed: event.monthsProcessed,
                    totalMonths: event.totalMonths,
                    message: event.message,
                  });
                } else if (event.type === 'saved') {
                  setProgress({
                    monthsProcessed: event.monthsProcessed || progress.monthsProcessed,
                    totalMonths: event.totalMonths || progress.totalMonths,
                    message: `Saved ${event.recordsCreated} records for ${event.month}`,
                  });
                } else if (event.type === 'error') {
                  // Non-fatal error, continue processing
                  console.warn(`Error for month ${event.month}: ${event.message}`);
                } else if (event.type === 'complete') {
                  const importResult: CSVImportResult = {
                    sessionId: event.sessionId,
                    status: event.status,
                    recordsCreated: event.totalRecordsCreated,
                    monthsProcessed: event.monthsProcessed,
                    totalMonths: event.totalMonths,
                    errors: event.errors || [],
                  };
                  setResult(importResult);
                  onComplete(importResult);
                }
              } catch (parseError) {
                console.error('Failed to parse SSE event:', parseError);
              }
            }
          }
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error during import';
        setError(errorMessage);
      }
    };

    processCSV();
  }, [file, context, onComplete]);

  if (error) {
    return (
      <div className='space-y-4'>
        <div className='bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3'>
          <AlertCircle className='h-5 w-5 text-red-600 flex-shrink-0 mt-0.5' />
          <div>
            <h3 className='text-sm font-semibold text-red-900'>
              Import Error
            </h3>
            <p className='text-sm text-red-800 mt-1'>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Progress Indicator */}
      <div className='flex items-center justify-center space-x-4'>
        <Loader2 className='h-6 w-6 text-blue-600 animate-spin' />
        <div>
          <p className='text-sm font-medium text-gray-900'>
            {progress.message}
          </p>
          <p className='text-xs text-gray-600 mt-1'>
            Processing month {progress.monthsProcessed} of {progress.totalMonths}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className='w-full bg-gray-200 rounded-full h-2'>
        <div
          className='bg-blue-600 h-2 rounded-full transition-all duration-300'
          style={{
            width: `${
              progress.totalMonths > 0
                ? (progress.monthsProcessed / progress.totalMonths) * 100
                : 0
            }%`,
          }}
        />
      </div>

      {/* Status Text */}
      <div className='text-center'>
        <p className='text-xs text-gray-600'>
          {progress.monthsProcessed} of {progress.totalMonths} months processed
        </p>
      </div>
    </div>
  );
}
