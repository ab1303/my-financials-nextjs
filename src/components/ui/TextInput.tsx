'use client';

import * as React from 'react';
import clsx from 'clsx';

export interface TextInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({ className, error, ...rest }, ref) => {
    return (
      <input
        ref={ref}
        className={clsx(
          'block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900',
          'focus:border-teal-500 focus:ring-teal-500',
          error &&
            'border-red-500 bg-red-50 text-red-900 placeholder-red-700 focus:border-red-500 focus:ring-red-500',
          className,
        )}
        {...rest}
      />
    );
  },
);
TextInput.displayName = 'TextInput';
