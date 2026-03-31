import React from 'react';
import { cn } from '@/lib/utils';

import CardBody from './components/CardBody';
import CardHeader from './components/CardHeader';

type CommonComponents = {
  Header: typeof CardHeader;
  Body: typeof CardBody;
};

type CardProps = {
  children?: React.ReactNode;
  variant?: 'base' | 'interactive' | 'elevated' | 'flat';
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>;

const Card: React.FC<CardProps> & CommonComponents = ({
  children,
  variant = 'base',
  className,
  ...props
}) => {
  const variantClasses = {
    base: 'rounded-xl border border-border bg-card text-card-foreground shadow',
    interactive:
      'rounded-xl border border-border bg-card text-card-foreground shadow hover:shadow-md transition-shadow cursor-pointer',
    elevated:
      'rounded-xl border border-border bg-card text-card-foreground shadow-md',
    flat: 'rounded-xl border border-border bg-card text-card-foreground',
  };

  return (
    <div className={cn(variantClasses[variant], 'mt-6', className)} {...props}>
      {children}
    </div>
  );
};

Card.Header = CardHeader;
Card.Body = CardBody;

export default Card;
