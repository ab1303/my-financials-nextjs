import React from 'react';
import clsx from 'clsx';

import { cardStyles } from '@/styles/theme';
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
  return (
    <div className={clsx(cardStyles[variant], 'mt-6', className)} {...props}>
      {children}
    </div>
  );
};

Card.Header = CardHeader;
Card.Body = CardBody;

export default Card;
