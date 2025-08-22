import clsx from 'clsx';
import * as React from 'react';
import { ImSpinner2 } from 'react-icons/im';

import { buttonStyles } from '@/styles/theme';

enum ButtonVariant {
  'dark',
  'light',
  'primary',
  'secondary',
}

type ButtonProps = {
  isLoading?: boolean;
  variant?: keyof typeof ButtonVariant;
  size?: 'default' | 'sm' | 'lg';
} & React.ComponentPropsWithoutRef<'button'>;

export default function Button({
  children,
  className,
  disabled: buttonDisabled,
  isLoading,
  variant = 'primary',
  size = 'default',
  ...rest
}: ButtonProps) {
  const disabled = isLoading || buttonDisabled;

  // Use theme utilities for primary and secondary, maintain backwards compatibility for dark/light
  const getButtonStyles = () => {
    switch (variant) {
      case 'primary':
        return buttonStyles.primary;
      case 'secondary':
        return buttonStyles.secondary;
      case 'dark':
        return 'flex w-full justify-center py-2 px-4 border border-gray-600 rounded-md shadow-sm rounded font-bold hover:text-teal-400 focus:outline-none focus-visible:text-teal-400 bg-gray-800 disabled:bg-gray-600 text-white disabled:hover:text-white';
      case 'light':
        return 'flex w-full justify-center py-2 px-4 border border-gray-400 rounded-md shadow-sm rounded font-bold hover:text-teal-400 focus:outline-none focus-visible:text-teal-400 bg-white disabled:bg-gray-200 text-dark hover:bg-gray-200 hover:text-dark focus-visible:text-dark disabled:hover:text-dark';
      default:
        return buttonStyles.primary;
    }
  };

  return (
    <button
      {...rest}
      disabled={disabled}
      className={clsx(
        getButtonStyles(),
        {
          'w-full': variant === 'dark' || variant === 'light', // Maintain backwards compatibility
        },
        'disabled:cursor-not-allowed',
        !disabled &&
          variant !== 'primary' &&
          variant !== 'secondary' &&
          'animated-underline',
        isLoading &&
          'relative text-transparent hover:!text-transparent !cursor-wait transition-none',
        className,
      )}
      style={
        variant === 'primary'
          ? ({
              '--clr-primary-400': 'white',
              '--clr-primary-500': 'white',
            } as React.CSSProperties)
          : undefined
      }
    >
      {isLoading && (
        <div
          className={clsx(
            'absolute -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2',
            variant === 'light' ? 'text-black' : 'text-white',
          )}
        >
          <ImSpinner2 className='animate-spin' />
        </div>
      )}
      {children}
    </button>
  );
}
