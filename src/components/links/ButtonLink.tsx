import * as React from 'react';
import clsx from 'clsx';

import type { UnstyledLinkProps } from '@/components/links/UnstyledLink';

import UnstyledLink from '@/components/links/UnstyledLink';

export interface ButtonLinkProps
  extends React.ComponentPropsWithoutRef<typeof UnstyledLink> {
  variant?: 'primary' | 'dark' | 'light';
}

export default function ButtonLink({
  children,
  className,
  variant = 'dark',
  ...rest
}: ButtonLinkProps) {
  return (
    <UnstyledLink
      {...rest}
      className={clsx(
        // Base button styles
        'py-2 px-4 inline-block rounded font-bold animated-underline',
        'border shadow-sm transition-colors duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        // Variant-specific styles
        {
          'bg-dark text-white border-gray-600 hover:text-primary-400 focus-visible:text-primary-400 focus-visible:ring-primary-400':
            variant === 'dark',
          'bg-white text-dark border-gray-400 hover:bg-gray-200 hover:text-dark focus-visible:text-dark focus-visible:ring-gray-400':
            variant === 'light',
          'bg-primary-400 text-black border-primary-500 hover:bg-primary-400/90 hover:text-black focus-visible:text-dark focus-visible:ring-primary-400':
            variant === 'primary',
        },
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
      {children}
    </UnstyledLink>
  );
}
