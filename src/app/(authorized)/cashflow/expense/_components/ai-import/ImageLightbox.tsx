'use client';

import { Fragment, useEffect, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { FiX, FiAlertCircle, FiLoader } from 'react-icons/fi';

export interface ImageLightboxProps {
  imageId: string;
  isOpen: boolean;
  onClose: () => void;
  fileName?: string;
}

type LoadingState = 'loading' | 'success' | 'error' | 'expired';

/**
 * ImageLightbox Component
 * Modal viewer for imported images with error handling and TTL expiration
 */
export default function ImageLightbox({
  imageId,
  isOpen,
  onClose,
  fileName,
}: ImageLightboxProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setImageUrl(null);
      setLoadingState('loading');
      setErrorMessage(null);
      return;
    }

    let isMounted = true;

    const fetchImage = async () => {
      try {
        setLoadingState('loading');
        setErrorMessage(null);

        const response = await fetch(`/api/ai-import/image/${imageId}`);

        if (!isMounted) return;

        if (response.status === 410) {
          // 410 Gone - Image expired
          setLoadingState('expired');
          setErrorMessage('This image has expired and is no longer available.');
          return;
        }

        if (!response.ok) {
          const error = await response.json();
          throw new Error(
            error.error || `Failed to load image (${response.status})`,
          );
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        if (isMounted) {
          setImageUrl(url);
          setLoadingState('success');
        }
      } catch (error) {
        if (isMounted) {
          setLoadingState('error');
          setErrorMessage(
            error instanceof Error ? error.message : 'Failed to load image',
          );
        }
      }
    };

    fetchImage();

    return () => {
      isMounted = false;
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [isOpen, imageId, imageUrl]);

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog onClose={onClose} className='relative z-50'>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter='ease-out duration-300'
          enterFrom='opacity-0'
          enterTo='opacity-100'
          leave='ease-in duration-200'
          leaveFrom='opacity-100'
          leaveTo='opacity-0'
        >
          <div className='fixed inset-0 bg-black/75' />
        </Transition.Child>

        {/* Modal Content */}
        <div className='fixed inset-0 overflow-y-auto'>
          <div className='flex min-h-full items-center justify-center p-4'>
            <Transition.Child
              as={Fragment}
              enter='ease-out duration-300'
              enterFrom='opacity-0 scale-95'
              enterTo='opacity-100 scale-100'
              leave='ease-in duration-200'
              leaveFrom='opacity-100 scale-100'
              leaveTo='opacity-0 scale-95'
            >
              <Dialog.Panel className='relative w-full max-w-4xl bg-white rounded-lg shadow-xl'>
                {/* Close Button */}
                <button
                  onClick={onClose}
                  className='absolute top-4 right-4 z-50 p-2 rounded-lg bg-white/90 hover:bg-white text-gray-600 hover:text-gray-900 transition-colors'
                  aria-label='Close lightbox'
                >
                  <FiX className='h-6 w-6' />
                </button>

                {/* Content */}
                <div className='p-6'>
                  {/* Title */}
                  {fileName && (
                    <h2 className='text-lg font-semibold text-gray-900 mb-4'>
                      {fileName}
                    </h2>
                  )}

                  {/* Loading State */}
                  {loadingState === 'loading' && (
                    <div className='flex flex-col items-center justify-center py-12'>
                      <FiLoader className='h-8 w-8 text-blue-600 animate-spin mb-4' />
                      <p className='text-gray-600'>Loading image...</p>
                    </div>
                  )}

                  {/* Error State */}
                  {loadingState === 'error' && (
                    <div className='bg-red-50 border border-red-200 rounded-lg p-6 flex items-start space-x-4'>
                      <FiAlertCircle className='h-6 w-6 text-red-600 flex-shrink-0 mt-0.5' />
                      <div>
                        <h3 className='text-sm font-semibold text-red-900'>
                          Failed to Load Image
                        </h3>
                        <p className='text-sm text-red-800 mt-1'>
                          {errorMessage}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Expired State */}
                  {loadingState === 'expired' && (
                    <div className='bg-yellow-50 border border-yellow-200 rounded-lg p-6 flex items-start space-x-4'>
                      <FiAlertCircle className='h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5' />
                      <div>
                        <h3 className='text-sm font-semibold text-yellow-900'>
                          Image Expired
                        </h3>
                        <p className='text-sm text-yellow-800 mt-1'>
                          {errorMessage}
                        </p>
                        <p className='text-xs text-yellow-700 mt-3'>
                          Imported images are automatically deleted after 7 days
                          to protect your privacy.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Image Display */}
                  {loadingState === 'success' && imageUrl && (
                    <div className='relative w-full bg-gray-100 rounded-lg overflow-hidden'>
                      {/* Blob URL: Next.js <Image> does not support blob: URLs, use native img */}
                      {/* alt describes the auditable source image content */}
                      <img // eslint-disable-line @next/next/no-img-element
                        src={imageUrl}
                        alt={
                          fileName
                            ? `Source image: ${fileName}`
                            : 'Source image used for this import'
                        }
                        className='w-full h-auto max-h-[70vh] object-contain'
                      />
                    </div>
                  )}

                  {/* Footer */}
                  {loadingState === 'success' && (
                    <div className='mt-6 pt-4 border-t border-gray-200 text-xs text-gray-500'>
                      <p>
                        This image is protected and only you can view it. It
                        will be automatically deleted after 7 days.
                      </p>
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
