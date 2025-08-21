'use client';

import { Dialog, Transition } from '@headlessui/react';
import React, { Fragment, ReactNode } from 'react';
import clsx from 'clsx';

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
    <Transition appear show={show} as={Fragment}>
      <Dialog as='div' className='relative z-50' onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter='ease-out duration-200'
          enterFrom='opacity-0'
          enterTo='opacity-100'
          leave='ease-in duration-150'
          leaveFrom='opacity-100'
          leaveTo='opacity-0'
        >
          <div className='fixed inset-0 bg-black/40 backdrop-blur-sm' />
        </Transition.Child>

        <div className='fixed inset-0 overflow-y-auto'>
          <div className='flex min-h-full items-start justify-center p-4'>
            <Transition.Child
              as={Fragment}
              enter='ease-out duration-200'
              enterFrom='opacity-0 scale-95'
              enterTo='opacity-100 scale-100'
              leave='ease-in duration-150'
              leaveFrom='opacity-100 scale-100'
              leaveTo='opacity-0 scale-95'
            >
              <Dialog.Panel
                className={clsx(
                  'w-full max-w-2xl transform overflow-hidden rounded-lg bg-white text-left align-middle shadow-xl transition-all',
                  panelClassName,
                )}
              >
                {children}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

const Header = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div className={clsx('px-6 pt-6 pb-4 border-b border-gray-200', className)}>
    {children}
  </div>
);

const Body = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => <div className={clsx('px-6 py-6 space-y-6', className)}>{children}</div>;

const Footer = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={clsx(
      'px-6 pt-4 pb-6 border-t border-gray-200 flex justify-end gap-3',
      className,
    )}
  >
    {children}
  </div>
);

export const Modal = Object.assign(ModalRoot, { Header, Body, Footer });
