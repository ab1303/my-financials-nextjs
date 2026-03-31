'use client';

import { useEffect, useState } from 'react';
import { FiLoader, FiCheck, FiX } from 'react-icons/fi';
import type { ProcessingStepProps, ImageResult } from './_types';
import {
  ExpenseImportRequestSchema,
  BankAssetImportRequestSchema,
  SSEEventSchema,
} from './_schema';

export default function ProcessingStep({
  files,
  onComplete,
  context,
}: ProcessingStepProps) {
  const [processedFiles, setProcessedFiles] = useState<
    Map<string, ImageResult>
  >(new Map());
  const [overallProgress, setOverallProgress] = useState(0);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processImages = async () => {
      try {
        // Step 1: Upload images
        const formData = new FormData();
        files.forEach((file) => {
          formData.append('files', file.file);
        });

        const uploadResponse = await fetch('/api/ai-import/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.error || 'Upload failed');
        }

        const uploadedImages: Array<{ imageId: string; fileName: string }> =
          await uploadResponse.json();
        const imageIds = uploadedImages.map((img) => img.imageId);

        // Step 2: Parse images with SSE
        const parseRequest =
          context.importType === 'BANK_ASSET'
            ? BankAssetImportRequestSchema.parse({
                imageIds,
                importType: 'BANK_ASSET',
                context: { snapshotDate: context.snapshotDate },
              })
            : ExpenseImportRequestSchema.parse({
                imageIds,
                importType: 'EXPENSE',
                context: {
                  calendarYearId: context.calendarYearId,
                  month: context.month,
                },
              });

        const parseResponse = await fetch('/api/ai-import/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parseRequest),
        });

        if (!parseResponse.ok) {
          throw new Error('Parse request failed');
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
                const validatedEvent = SSEEventSchema.parse(event);

                if (validatedEvent.type === 'progress') {
                  setCurrentImage(validatedEvent.currentImage);
                  setOverallProgress(
                    Math.round(
                      ((validatedEvent.imageIndex + 1) /
                        validatedEvent.totalImages) *
                        100,
                    ),
                  );
                } else if (validatedEvent.type === 'extraction') {
                  setProcessedFiles((prev) => {
                    const newMap = new Map(prev);
                    const existing = newMap.get(validatedEvent.imageId) || {
                      imageId: validatedEvent.imageId,
                      fileName: '',
                      status: 'success' as const,
                    };
                    newMap.set(validatedEvent.imageId, {
                      ...existing,
                      confidence: validatedEvent.confidence,
                    });
                    return newMap;
                  });
                } else if (validatedEvent.type === 'saved') {
                  setProcessedFiles((prev) => {
                    const newMap = new Map(prev);
                    const existing = newMap.get(validatedEvent.imageId) || {
                      imageId: validatedEvent.imageId,
                      fileName: '',
                      status: 'success' as const,
                    };
                    newMap.set(validatedEvent.imageId, {
                      ...existing,
                      entriesCreated: validatedEvent.entriesCreated,
                    });
                    return newMap;
                  });
                } else if (validatedEvent.type === 'error') {
                  setProcessedFiles((prev) => {
                    const newMap = new Map(prev);
                    newMap.set(validatedEvent.imageId, {
                      imageId: validatedEvent.imageId,
                      fileName: '',
                      status: 'failed',
                      errorMessage: validatedEvent.errorMessage,
                    });
                    return newMap;
                  });
                } else if (validatedEvent.type === 'complete') {
                  // Build final results
                  const results = validatedEvent.images.map((img) => ({
                    imageId: img.imageId,
                    fileName: img.fileName,
                    status: img.status,
                    confidence: img.confidence,
                    entriesCreated: img.entriesCreated,
                    errorMessage: img.errorMessage,
                  }));

                  onComplete({
                    sessionId: validatedEvent.sessionId,
                    recordsCreated: validatedEvent.recordsCreated,
                    overallConfidence: validatedEvent.overallConfidence,
                    images: results,
                  });
                }
              } catch (parseError) {
                console.error('Failed to parse SSE event:', parseError);
              }
            }
          }
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Processing failed';
        setError(message);
        console.error('Processing error:', err);
      }
    };

    processImages();
  }, [files, context, onComplete]);

  return (
    <div className='space-y-6'>
      {/* Overall Progress */}
      <div className='space-y-2'>
        <div className='flex justify-between items-center'>
          <h3 className='text-sm font-semibold text-gray-900'>
            Processing Images
          </h3>
          <span className='text-sm font-medium text-gray-600'>
            {overallProgress}%
          </span>
        </div>
        <div className='w-full bg-gray-200 rounded-full h-2 overflow-hidden'>
          <div
            className='bg-blue-600 h-full transition-all duration-300'
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* Current Processing Image */}
      {currentImage && (
        <p className='text-sm text-gray-600 text-center'>
          Processing: <span className='font-medium'>{currentImage}</span>
        </p>
      )}

      {/* Error Banner */}
      {error && (
        <div className='bg-red-50 border border-red-200 rounded-lg p-4'>
          <p className='text-sm text-red-800 font-medium'>Processing Failed</p>
          <p className='text-sm text-red-700 mt-1'>{error}</p>
        </div>
      )}

      {/* Processing Details */}
      {processedFiles.size > 0 && (
        <div className='space-y-3'>
          {Array.from(processedFiles.values()).map((result) => (
            <div
              key={result.imageId}
              className='flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200'
            >
              <div className='flex items-center space-x-3 flex-1 min-w-0'>
                <div className='flex-shrink-0'>
                  {result.status === 'success' && (
                    <FiCheck className='h-5 w-5 text-green-600' />
                  )}
                  {result.status === 'failed' && (
                    <FiX className='h-5 w-5 text-red-600' />
                  )}
                  {result.status === 'partial' && (
                    <FiLoader className='h-5 w-5 text-yellow-600 animate-spin' />
                  )}
                </div>
                <div className='min-w-0'>
                  <p className='text-sm font-medium text-gray-900 truncate'>
                    {result.fileName}
                  </p>
                  {result.status === 'success' &&
                    result.entriesCreated !== undefined && (
                      <p className='text-xs text-gray-600'>
                        {result.entriesCreated} entries created
                      </p>
                    )}
                  {result.status === 'failed' && result.errorMessage && (
                    <p className='text-xs text-red-600'>
                      {result.errorMessage}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
