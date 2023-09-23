// https://floating-ui.com/docs/dialog

import React, { useId, useState } from 'react';
import {
  FloatingFocusManager,
  FloatingOverlay,
  offset,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import { format, isValid, parse } from 'date-fns';
import { DayPicker } from 'react-day-picker';
import clsx from 'clsx';

import type { ChangeEventHandler } from 'react';

type DatePickerDialogProps = {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
};

export default function DatePickerDialog({
  selectedDate,
  onDateChange,
}: DatePickerDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { refs, context, floatingStyles } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [offset(10)],
  });

  // const click = useClick(context);
  const dismiss = useDismiss(context, {
    outsidePressEvent: 'mousedown',
  });
  const role = useRole(context);

  // Merge all the interactions into prop getters
  const { getReferenceProps, getFloatingProps } = useInteractions([
    // click,
    dismiss,
    role,
  ]);

  // Set up label and description ids
  const labelId = useId();
  const descriptionId = useId();

  const handleInputChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const date = parse(e.currentTarget.value, 'y-MM-dd', new Date());
    if (isValid(date)) {
      onDateChange(date);
    }
  };

  const handleDaySelect = (date: Date) => {
    onDateChange(date);
    if (date) {
      setIsOpen(false);
    }
  };

  return (
    <div>
      <div
        className='relative max-w-sm'
        onClick={() => setIsOpen(true)}
        ref={refs.setReference}
        {...getReferenceProps()}
      >
        <div className='absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none'>
          <svg
            className='w-4 h-4 text-gray-500 dark:text-gray-400'
            aria-hidden='true'
            xmlns='http://www.w3.org/2000/svg'
            fill='currentColor'
            viewBox='0 0 20 20'
          >
            <path d='M20 4a2 2 0 0 0-2-2h-2V1a1 1 0 0 0-2 0v1h-3V1a1 1 0 0 0-2 0v1H6V1a1 1 0 0 0-2 0v1H2a2 2 0 0 0-2 2v2h20V4ZM0 18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8H0v10Zm5-8h10a1 1 0 0 1 0 2H5a1 1 0 0 1 0-2Z' />
          </svg>
        </div>
        <input
          size={12}
          type='text'
          className={clsx(
            ' block w-full pl-10',
            'bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500',
            'dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500'
          )}
          placeholder={format(new Date(), 'y-MM-dd')}
          value={format(selectedDate, 'y-MM-dd')}
          onChange={handleInputChange}
        />
      </div>
      {isOpen && (
        <FloatingOverlay>
          <FloatingFocusManager context={context}>
            <div
              ref={refs.setFloating}
              aria-labelledby={labelId}
              aria-describedby={descriptionId}
              style={floatingStyles}
              className='rounded bg-neutral-50 shadow-lg'
              {...getFloatingProps()}
            >
              <DayPicker
                initialFocus={isOpen}
                mode='single'
                defaultMonth={selectedDate}
                selected={selectedDate}
                onSelect={(_, selectedDay) => handleDaySelect(selectedDay)}
              />
            </div>
          </FloatingFocusManager>
        </FloatingOverlay>
      )}
    </div>
  );
}
