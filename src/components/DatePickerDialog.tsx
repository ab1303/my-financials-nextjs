// https://floating-ui.com/docs/dialog

import React, { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FloatingFocusManager,
  FloatingOverlay,
  offset,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
  useClick,
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
    placement: 'bottom-start',
  });

  const click = useClick(context);
  const dismiss = useDismiss(context, {
    outsidePressEvent: 'mousedown',
  });
  const role = useRole(context);

  // Merge all the interactions into prop getters
  const { getReferenceProps, getFloatingProps } = useInteractions([
    click,
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
      <div className='relative max-w-sm' ref={refs.setReference}>
        <button
          type='button'
          className='absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-auto z-10'
          onClick={() => setIsOpen(true)}
          {...getReferenceProps()}
        >
          <svg
            className='w-4 h-4 text-gray-500 hover:text-gray-700'
            aria-hidden='true'
            xmlns='http://www.w3.org/2000/svg'
            fill='currentColor'
            viewBox='0 0 20 20'
          >
            <path d='M20 4a2 2 0 0 0-2-2h-2V1a1 1 0 0 0-2 0v1h-3V1a1 1 0 0 0-2 0v1H6V1a1 1 0 0 0-2 0v1H2a2 2 0 0 0-2 2v2h20V4ZM0 18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8H0v10Zm5-8h10a1 1 0 0 1 0 2H5a1 1 0 0 1 0-2Z' />
          </svg>
        </button>
        <input
          size={12}
          type='text'
          className='block w-full pl-10 px-3 py-2 border border-gray-300 bg-gray-50 text-gray-900 text-sm rounded-lg focus:ring-teal-500 focus:border-teal-500'
          placeholder={format(new Date(), 'y-MM-dd')}
          value={format(selectedDate, 'y-MM-dd')}
          onChange={handleInputChange}
        />
      </div>
      {isOpen &&
        createPortal(
          <FloatingOverlay className='z-[60] bg-black/20'>
            <FloatingFocusManager context={context}>
              <div
                ref={refs.setFloating}
                aria-labelledby={labelId}
                aria-describedby={descriptionId}
                style={floatingStyles}
                className='rounded-lg bg-white border border-gray-200 shadow-xl p-4'
                {...getFloatingProps()}
              >
                <DayPicker
                  initialFocus={isOpen}
                  mode='single'
                  defaultMonth={selectedDate}
                  selected={selectedDate}
                  onSelect={(_, selectedDay) => handleDaySelect(selectedDay)}
                  classNames={{
                    months:
                      'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
                    month: 'space-y-4',
                    caption: 'flex justify-between items-center pt-1 pb-2 px-2',
                    caption_label: 'text-base font-semibold text-gray-800',
                    nav: 'flex items-center space-x-1',
                    nav_button:
                      'h-7 w-7 bg-gray-50 border border-gray-200 text-gray-600 hover:text-gray-800 hover:bg-gray-100 hover:border-gray-300 rounded-md transition-all duration-150 flex items-center justify-center shadow-sm',
                    nav_button_previous: '',
                    nav_button_next: '',
                    table: 'w-full border-collapse space-y-1',
                    head_row: 'flex',
                    head_cell:
                      'text-gray-500 rounded-md w-9 font-normal text-[0.8rem]',
                    row: 'flex w-full mt-2',
                    cell: 'text-center text-sm p-0 relative [&:has([aria-selected])]:bg-gray-100 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20',
                    day: 'h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-gray-100 rounded-md',
                    day_selected:
                      'bg-teal-600 text-white hover:bg-teal-600 hover:text-white focus:bg-teal-600 focus:text-white',
                    day_today: 'bg-gray-100 text-gray-900',
                    day_outside: 'text-gray-400 opacity-50',
                    day_disabled: 'text-gray-400 opacity-50',
                    day_hidden: 'invisible',
                  }}
                />
              </div>
            </FloatingFocusManager>
          </FloatingOverlay>,
          document.body,
        )}
    </div>
  );
}
