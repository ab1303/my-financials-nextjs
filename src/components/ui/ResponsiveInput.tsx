'use client';

import React from 'react';
import clsx from 'clsx';
import { inputStyles } from '@/styles/theme';
import { stylingUtils } from '@/styles/styling';

interface ResponsiveInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  width?: 'sm' | 'md' | 'lg' | 'xl' | 'full' | string;
  variant?: 'base' | 'error' | 'disabled';
  withIcon?: boolean;
}

/**
 * ResponsiveInput component that properly handles width overrides
 * and follows the styling best practices with clsx and stylingUtils
 */
export default function ResponsiveInput({
  width = 'full',
  variant = 'base',
  withIcon = false,
  className,
  ...props
}: ResponsiveInputProps) {
  // Get the base style
  const baseStyle = withIcon ? inputStyles.withIcon : inputStyles[variant];

  // Define width mapping
  const widthMap: Record<string, string> = {
    sm: 'w-1/4',
    md: 'w-1/2',
    lg: 'w-3/4',
    xl: 'w-full',
    full: 'w-full',
  };

  // Get the width class - use mapping or custom width
  const widthClass = widthMap[width] || width;

  // Override the width properly using stylingUtils
  const inputClassName = stylingUtils.overrideClasses(
    baseStyle,
    { w: widthClass },
    className,
  );

  return <input className={inputClassName} {...props} />;
}

// Export width utilities for use in other components
export const inputWidthUtils = {
  responsive: stylingUtils.responsiveWidth.input,
  override: (baseClass: string, width: string) =>
    stylingUtils.overrideClasses(baseClass, { w: width }),
};
