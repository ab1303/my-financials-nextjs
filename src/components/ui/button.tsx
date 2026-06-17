"use client";

import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'default' | 'outline' | 'ghost' | 'destructive';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: ButtonVariant;
  isLoading?: boolean;
  size?: 'default' | 'sm' | 'lg';
}

export function buttonVariants({ variant }: { variant?: ButtonVariant }) {
  switch (variant) {
    case 'destructive':
      return 'bg-red-600 text-white hover:bg-red-700';
    case 'outline':
      return 'border border-gray-300 bg-transparent text-gray-800 hover:bg-gray-50';
    case 'ghost':
      return 'bg-transparent text-gray-800 hover:bg-gray-100';
    case 'secondary':
      return 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100';
    default:
      return 'bg-sky-600 text-white hover:bg-sky-700';
  }
}

export function Button({ children, onClick, variant = 'primary', isLoading, size = 'default', className = '', ...rest }: ButtonProps) {
  const base = 'rounded-md font-medium';
  const sizeCls = size === 'sm' ? 'px-3 py-1 text-sm' : size === 'lg' ? 'px-6 py-3 text-lg' : 'px-4 py-2';
  const style = buttonVariants({ variant });

  return (
    <button onClick={onClick} className={`${base} ${sizeCls} ${style} ${className}`} {...rest}>
      {isLoading ? <span className="opacity-50">{children}</span> : children}
    </button>
  );
}

export default Button;
