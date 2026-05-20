'use client';

import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';

type ModalRootProps = {
  show: boolean;
  onClose: () => void;
  children: ReactNode;
  panelClassName?: string;
};

const ModalRoot = ({
  show,
  onClose,
  children,
  panelClassName,
}: ModalRootProps) => {
  return (
    <Dialog
      open={show}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className={cn('flex flex-col max-h-[95vh] overflow-hidden max-w-6xl md:max-w-4xl sm:max-w-3xl xs:max-w-sm !p-0 !gap-0', panelClassName)}>
        {children}
      </DialogContent>
    </Dialog>
  );
};

const Header = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <DialogTitle
    className={cn(
      'shrink-0 pt-4 sm:pt-3 pb-4 sm:pb-3 px-6 border-b border-border text-base sm:text-sm font-normal leading-normal tracking-normal',
      className,
    )}
  >
    {children}
  </DialogTitle>
);

const Body = ({
  children,
  className,
  variant = 'base',
}: {
  children: ReactNode;
  className?: string;
  variant?: 'base' | 'compact' | 'spacious' | 'flowbite';
}) => {
  const variantClasses = {
    base: 'py-4 sm:py-3',
    compact: 'py-2 sm:py-1',
    spacious: 'py-6 sm:py-4',
    flowbite: 'py-4 sm:py-2',
  };
  return (
    <div className='flex-1 min-h-0 overflow-y-auto'>
      <div className={cn('px-6', variantClasses[variant], className)}>
        {children}
      </div>
    </div>
  );
};

const Footer = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      'shrink-0 pt-4 sm:pt-3 pb-4 sm:pb-3 px-6 border-t border-border flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3',
      className,
    )}
  >
    {children}
  </div>
);

type CommonComponents = {
  Header: typeof Header;
  Body: typeof Body;
  Footer: typeof Footer;
};

const Modal: React.FC<ModalRootProps> & CommonComponents =
  ModalRoot as React.FC<ModalRootProps> & CommonComponents;
Modal.Header = Header;
Modal.Body = Body;
Modal.Footer = Footer;

export { Modal };
export default Modal;
