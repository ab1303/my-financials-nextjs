import React, { useId } from 'react';
import { createPortal } from 'react-dom';
import {
  FloatingFocusManager,
  FloatingOverlay,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import {
  FaExclamationTriangle,
  FaTimes,
  FaTrash,
  FaCheck,
} from 'react-icons/fa';

type ConfirmationDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  details?: {
    date?: string;
    amount?: string;
    [key: string]: string | undefined;
  };
  confirmButtonText?: string;
  cancelButtonText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
};

export default function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  details,
  confirmButtonText = 'Confirm',
  cancelButtonText = 'Cancel',
  variant = 'danger',
  isLoading = false,
}: ConfirmationDialogProps) {
  const { refs, context, floatingStyles } = useFloating({
    open: isOpen,
    onOpenChange: onClose,
  });

  const dismiss = useDismiss(context, {
    outsidePressEvent: 'mousedown',
  });
  const role = useRole(context);

  const { getFloatingProps } = useInteractions([dismiss, role]);

  const labelId = useId();
  const descriptionId = useId();

  const variantStyles = {
    danger: {
      icon: FaExclamationTriangle,
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      confirmBtn: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    },
    warning: {
      icon: FaExclamationTriangle,
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
      confirmBtn: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
    },
    info: {
      icon: FaCheck,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      confirmBtn: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    },
  };

  const currentVariant = variantStyles[variant];
  const IconComponent = currentVariant.icon;

  if (!isOpen) return null;

  return createPortal(
    <FloatingOverlay className='z-[70] bg-black/50'>
      <FloatingFocusManager context={context}>
        <div
          ref={refs.setFloating}
          aria-labelledby={labelId}
          aria-describedby={descriptionId}
          style={floatingStyles}
          className='fixed inset-0 flex items-center justify-center p-4 sm:p-6'
          {...getFloatingProps()}
        >
          <div className='bg-white rounded-lg shadow-xl max-w-md w-full max-h-screen overflow-y-auto transform transition-all'>
            {/* Header */}
            <div className='flex items-center justify-between p-4 sm:p-6 border-b border-gray-200'>
              <div className='flex items-center space-x-3'>
                <div className={`rounded-full p-2 ${currentVariant.iconBg}`}>
                  <IconComponent
                    className={`h-5 w-5 ${currentVariant.iconColor}`}
                  />
                </div>
                <h3
                  id={labelId}
                  className='text-lg font-semibold text-gray-900'
                >
                  {title}
                </h3>
              </div>
              <button
                onClick={onClose}
                className='text-gray-400 hover:text-gray-500 rounded-full p-2 hover:bg-gray-100 transition-colors touch-manipulation'
                aria-label='Close dialog'
              >
                <FaTimes className='h-4 w-4' />
              </button>
            </div>

            {/* Content */}
            <div className='px-4 sm:px-6 py-4'>
              <p id={descriptionId} className='text-sm text-gray-600 mb-4'>
                {message}
              </p>

              {details && (
                <div className='bg-gray-50 rounded-lg p-4 space-y-2'>
                  {Object.entries(details).map(
                    ([key, value]) =>
                      value && (
                        <div
                          key={key}
                          className='flex justify-between items-center text-sm sm:text-base'
                        >
                          <span className='font-medium text-gray-700 capitalize'>
                            {key.replace(/([A-Z])/g, ' $1').trim()}:
                          </span>
                          <span className='text-gray-900 font-mono'>
                            {value}
                          </span>
                        </div>
                      ),
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className='flex items-center justify-end space-x-3 px-4 sm:px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg'>
              <button
                type='button'
                onClick={onClose}
                disabled={isLoading}
                className='px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation min-h-[44px]'
              >
                {cancelButtonText}
              </button>
              <button
                type='button'
                onClick={onConfirm}
                disabled={isLoading}
                className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation min-h-[44px] ${currentVariant.confirmBtn}`}
              >
                {isLoading ? (
                  <div className='flex items-center space-x-2'>
                    <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white'></div>
                    <span>Processing...</span>
                  </div>
                ) : (
                  <div className='flex items-center space-x-2'>
                    <FaTrash className='h-4 w-4' />
                    <span>{confirmButtonText}</span>
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      </FloatingFocusManager>
    </FloatingOverlay>,
    document.body,
  );
}
