'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const labelVariants = cva(
  'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 user-select-none',
);

export interface LabelProps
  extends
    React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>,
    VariantProps<typeof labelVariants> {
  requiredIndicator?: boolean | React.ReactNode;
  error?: boolean;
}

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  LabelProps
>(({ className, children, requiredIndicator, error, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), error && 'text-destructive', className)}
    {...props}
  >
    <span className='inline-flex items-center gap-1'>
      {children}
      {requiredIndicator ? (
        requiredIndicator === true ? (
          <span className='text-destructive' aria-hidden='true'>
            *
          </span>
        ) : (
          requiredIndicator
        )
      ) : null}
    </span>
  </LabelPrimitive.Root>
));
Label.displayName = LabelPrimitive.Root.displayName;
