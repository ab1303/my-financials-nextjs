'use client';

import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader as ShadcnDialogHeader,
  DialogFooter as ShadcnDialogFooter,
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
      <DialogContent className={cn('max-w-2xl', panelClassName)}>
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
  <div className={cn('pb-4 border-b border-border', className)}>{children}</div>
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
    base: 'py-4',
    compact: 'py-2',
    spacious: 'py-6',
    flowbite: 'py-4',
  };
  return (
    <div className={cn(variantClasses[variant], className)}>{children}</div>
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
      'pt-4 border-t border-border flex justify-end gap-3',
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

export default Modal;
