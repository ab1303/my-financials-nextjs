'use client';

import * as React from 'react';
import clsx from 'clsx';

import { inputStyles } from '@/styles/theme';

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
          inputStyles.base,
          error && inputStyles.error,
          className,
        )}
        {...rest}
      />
    );
  },
);
TextInput.displayName = 'TextInput';
