'use client';

import React from 'react';
import { AlertTriangle, Check, Trash2, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ConfirmationDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  details?: {
    date?: string;
    amount?: string;
    [key: string]: string | undefined;
  };
  confirmButtonText?: string;
  cancelButtonText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
};

export default function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  details,
  confirmButtonText = 'Confirm',
  cancelButtonText = 'Cancel',
  variant = 'danger',
  isLoading = false,
}: ConfirmationDialogProps) {
  const variantConfig = {
    danger: {
      Icon: AlertTriangle,
      iconBg: 'bg-destructive/10',
      iconColor: 'text-destructive',
      confirmVariant: 'destructive' as const,
    },
    warning: {
      Icon: AlertTriangle,
      iconBg: 'bg-yellow-100 dark:bg-yellow-900/20',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
      confirmVariant: 'destructive' as const,
    },
    info: {
      Icon: Check,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      confirmVariant: 'default' as const,
    },
  };

  const config = variantConfig[variant];
  const { Icon } = config;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialogContent className='max-w-md'>
        <AlertDialogHeader>
          <div className='flex items-center space-x-3 mb-2'>
            <div className={cn('rounded-full p-2', config.iconBg)}>
              <Icon className={cn('h-5 w-5', config.iconColor)} />
            </div>
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>

        {details && (
          <div className='bg-muted rounded-lg p-4 space-y-2 my-2'>
            {Object.entries(details).map(
              ([key, value]) =>
                value && (
                  <div
                    key={key}
                    className='flex justify-between items-center text-sm'
                  >
                    <span className='font-medium text-foreground capitalize'>
                      {key.replace(/([A-Z])/g, ' $1').trim()}:
                    </span>
                    <span className='text-foreground font-mono'>{value}</span>
                  </div>
                ),
            )}
          </div>
        )}

        <AlertDialogFooter>
          <Button
            variant='outline'
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelButtonText}
          </Button>
          <Button
            variant={config.confirmVariant}
            onClick={onConfirm}
            disabled={isLoading}
            isLoading={isLoading}
          >
            {!isLoading && <Trash2 className='h-4 w-4' />}
            {confirmButtonText}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

