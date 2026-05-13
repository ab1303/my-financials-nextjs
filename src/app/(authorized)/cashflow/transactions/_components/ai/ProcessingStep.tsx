'use client';

import { useEffect, useState } from 'react';
import { Loader2, Check, X } from 'lucide-react';
import type { ExtractedImageResult, UploadedFile } from './_types';
import { SSEEventSchema } from './_schema';

interface ProcessingStepProps {
  files: UploadedFile[];
  bankAccountId?: string | null;
  onComplete: (sessionId: string, images: ExtractedImageResult[]) => void;
  context: { calendarYearId: string; month: number };
}

export default function ProcessingStep({
  files,
  bankAccountId,
  onComplete,
  context,
}: ProcessingStepProps) {
  const [extractedImages, setExtractedImages] = useState<ExtractedImageResult[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const processImages = async () => {
      try {
        const formData = new FormData();
        files.forEach((file) => {
          formData.append('files', file.file);
        });

        if (bankAccountId) {
          formData.append('bankAccountId', bankAccountId);
        }

        const uploadResponse = await fetch('/api/transactions/ai/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json().catch(() => ({}));
          throw new Error(errorData.error || 'Upload failed');
        }

        const uploadedImages: Array<{ imageId: string; fileName: string }> =
          await uploadResponse.json();
        const imageIds = uploadedImages.map((img) => img.imageId);

        const parseResponse = await fetch('/api/transactions/ai/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageIds,
            bankAccountId: bankAccountId ?? undefined,
            context,
          }),
        });

        if (!parseResponse.ok) {
          const errorData = await parseResponse.json().catch(() => ({}));
          throw new Error(errorData.error || 'Parse request failed');
        }

        if (!parseResponse.body) {
          throw new Error('No response body');
        }

        const uploadedFileNameById = new Map(
          uploadedImages.map((img) => [img.imageId, img.fileName]),
        );
        let currentExtractedImages: ExtractedImageResult[] = [];

        const updateImages = (nextImages: ExtractedImageResult[]) => {
          currentExtractedImages = nextImages;
          if (!cancelled) {
            setExtractedImages(nextImages);
          }
        };

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
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;

            const jsonStr = trimmed.replace(/^data:\s*/, '');

            try {
              const event = JSON.parse(jsonStr);
              const validatedEvent = SSEEventSchema.parse(event);

              if (validatedEvent.type === 'progress') {
                if (!cancelled) {
                  setCurrentImage(validatedEvent.currentImage);
                  setOverallProgress(
                    Math.round(
                      ((validatedEvent.imageIndex + 1) /
                        validatedEvent.totalImages) *
                        100,
                    ),
                  );
                }
              } else if (validatedEvent.type === 'extracted') {
                const newImage: ExtractedImageResult = {
                  imageId: validatedEvent.imageId,
                  fileName: '',
                  confidence: validatedEvent.confidence,
                  entries: ((validatedEvent.entries as Array<{
                    categoryName: string;
                    amount: number;
                  }>) ?? []).map((e, i) => ({
                    id: String(i),
                    categoryName: e.categoryName,
                    amount: e.amount,
                    confirmed: true,
                  })),
                  status: 'success',
                };

                updateImages([...currentExtractedImages, newImage]);
              } else if (validatedEvent.type === 'error') {
                const nextImages = currentExtractedImages.some(
                  (img) => img.imageId === validatedEvent.imageId,
                )
                  ? currentExtractedImages.map((img) =>
                      img.imageId === validatedEvent.imageId
                        ? {
                            ...img,
                            status: 'failed' as const,
                            errorMessage: validatedEvent.errorMessage,
                          }
                        : img,
                    )
                  : [
                      ...currentExtractedImages,
                      {
                        imageId: validatedEvent.imageId,
                        fileName:
                          uploadedFileNameById.get(validatedEvent.imageId) ?? '',
                        confidence: 0,
                        entries: [],
                        status: 'failed' as const,
                        errorMessage: validatedEvent.errorMessage,
                      },
                    ];
                updateImages(nextImages);
              } else if (validatedEvent.type === 'complete') {
                const mergedImages = currentExtractedImages.map((image) => {
                  const completedImage = validatedEvent.images.find(
                    (img) => img.imageId === image.imageId,
                  );

                  if (!completedImage) return image;

                  return {
                    ...image,
                    fileName:
                      completedImage.fileName ||
                      uploadedFileNameById.get(image.imageId) ||
                      image.fileName,
                    confidence: completedImage.confidence ?? image.confidence,
                    entries: completedImage.entries ?? image.entries,
                    status: completedImage.status,
                    errorMessage: completedImage.errorMessage,
                  };
                });

                const nextImages =
                  mergedImages.length > 0 ? mergedImages : currentExtractedImages;

                updateImages(nextImages);
                if (!cancelled) {
                  onComplete(validatedEvent.sessionId as string, nextImages);
                }
              }
            } catch (parseError) {
              console.error('Failed to parse SSE event:', parseError);
            }
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Processing failed';
        if (!cancelled) {
          setError(message);
        }
        console.error('Processing error:', err);
      }
    };

    processImages();

    return () => {
      cancelled = true;
    };
  }, [files, bankAccountId, context, onComplete]);

  return (
    <div className='space-y-6'>
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

      {currentImage && (
        <p className='text-sm text-gray-600 text-center'>
          Processing: <span className='font-medium'>{currentImage}</span>
        </p>
      )}

      {error && (
        <div className='bg-red-50 border border-red-200 rounded-lg p-4'>
          <p className='text-sm text-red-800 font-medium'>Processing Failed</p>
          <p className='text-sm text-red-700 mt-1'>{error}</p>
        </div>
      )}

      {extractedImages.length > 0 && (
        <div className='space-y-3'>
          {extractedImages.map((result) => (
            <div
              key={result.imageId}
              className='flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200'
            >
              <div className='flex items-center space-x-3 flex-1 min-w-0'>
                <div className='flex-shrink-0'>
                  {result.status === 'success' && (
                    <Check className='h-5 w-5 text-green-600' />
                  )}
                  {result.status === 'failed' && (
                    <X className='h-5 w-5 text-red-600' />
                  )}
                </div>
                <div className='min-w-0'>
                  <p className='text-sm font-medium text-gray-900 truncate'>
                    {result.fileName || result.imageId}
                  </p>
                  <p className='text-xs text-gray-600'>
                    {result.entries.length} entries extracted
                  </p>
                  {result.status === 'failed' && result.errorMessage && (
                    <p className='text-xs text-red-600'>{result.errorMessage}</p>
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
