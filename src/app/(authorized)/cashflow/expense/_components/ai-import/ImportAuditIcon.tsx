'use client';

import { useState } from 'react';
import { Camera } from 'lucide-react';
import ImageLightbox from './ImageLightbox';

export interface ImportAuditIconProps {
  importImageId: string;
  fileName?: string;
}

/**
 * ImportAuditIcon Component
 * Display a camera icon on records that were imported from AI images
 * Click to view the source image in a lightbox modal
 */
export default function ImportAuditIcon({
  importImageId,
  fileName,
}: ImportAuditIconProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className='inline-flex items-center justify-center p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors'
        title={
          fileName
            ? `Imported from: ${fileName}`
            : 'Click to view source image'
        }
        aria-label={`View source image ${fileName ? `(${fileName})` : ''}`}
      >
        <Camera className='h-4 w-4' />
      </button>

      <ImageLightbox
        imageId={importImageId}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        fileName={fileName}
      />
    </>
  );
}
