'use client';

import { useCallback, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FiUploadCloud, FiX } from 'react-icons/fi';
import Image from 'next/image';
import MONTHS_MAP from '@/constants/map';
import { sanitizeImages } from '@/utils/image-sanitization';
import type { UploadStepProps, UploadedFile } from './_types';

export default function UploadStep({
  files,
  onFilesSelected,
  onRemoveFile,
  onStartImport,
  context,
}: UploadStepProps) {
  const [sanitizationError, setSanitizationError] = useState<string | null>(null);

  const acceptedFormats = useMemo(
    () => ({
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
      'image/heic': ['.heic'],
    }),
    [],
  );

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setSanitizationError(null);

      try {
        // Sanitize images to remove EXIF metadata
        const sanitizedFiles = await sanitizeImages(acceptedFiles);

        const newFiles: UploadedFile[] = sanitizedFiles.map((file) => {
          // Use URL.createObjectURL for synchronous preview
          const preview = URL.createObjectURL(file);

          return {
            id: Math.random().toString(36).substr(2, 9),
            file,
            preview,
            status: 'pending',
          };
        });

        onFilesSelected([...files, ...newFiles]);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to sanitize images';
        setSanitizationError(errorMessage);
        console.error('Image sanitization failed:', error);
      }
    },
    [files, onFilesSelected],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFormats,
    maxFiles: 10,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  return (
    <div className='space-y-6'>
      {/* Sanitization Error Banner */}
      {sanitizationError && (
        <div className='bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3'>
          <FiX className='h-5 w-5 text-red-600 flex-shrink-0 mt-0.5' />
          <div>
            <h3 className='text-sm font-semibold text-red-900'>
              Image Processing Error
            </h3>
            <p className='text-sm text-red-800 mt-1'>{sanitizationError}</p>
          </div>
        </div>
      )}

      {/* Context Display */}
      <div className='bg-blue-50 border border-blue-200 rounded-lg p-4'>
        <h3 className='text-sm font-semibold text-blue-900 mb-2'>
          Import Details
        </h3>
        <div className='text-sm text-blue-800'>
          <p>
            <span className='font-medium'>Month:</span>{' '}
            {MONTHS_MAP.get(context.month) || `Month ${context.month}`}
          </p>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        <FiUploadCloud className='mx-auto h-12 w-12 text-gray-400 mb-4' />
        <p className='text-lg font-medium text-gray-900 mb-2'>
          {isDragActive
            ? 'Drop your banking screenshots here'
            : 'Drop your banking screenshots here'}
        </p>
        <p className='text-sm text-gray-600 mb-4'>
          or <span className='text-blue-600 font-medium'>click to browse</span>
        </p>
        <p className='text-xs text-gray-500'>
          PNG, JPG, HEIC, WebP • Max 10MB each • Up to 10 images
        </p>
      </div>

      {/* Image Thumbnails Grid */}
      {files.length > 0 && (
        <div className='space-y-4'>
          <h3 className='text-sm font-semibold text-gray-900'>
            Selected Images ({files.length})
          </h3>
          <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4'>
            {files.map((uploadedFile) => (
              <div
                key={uploadedFile.id}
                className='relative rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow group'
              >
                {uploadedFile.preview && (
                  <Image
                    alt={uploadedFile.file.name}
                    src={uploadedFile.preview}
                    width={150}
                    height={150}
                    className='w-full h-32 object-cover'
                  />
                )}

                {/* Remove Button */}
                <button
                  onClick={() => onRemoveFile(uploadedFile.id)}
                  className='absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity'
                  aria-label='Remove image'
                >
                  <FiX className='h-4 w-4' />
                </button>

                {/* Status Indicator */}
                <div className='absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-2 text-white text-xs truncate'>
                  {uploadedFile.file.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Start Import Button */}
      <button
        onClick={onStartImport}
        disabled={files.length === 0}
        className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
          files.length > 0
            ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
        }`}
      >
        {files.length > 0
          ? `Start Import (${files.length} image${files.length !== 1 ? 's' : ''})`
          : 'Select at least one image'}
      </button>
    </div>
  );
}
