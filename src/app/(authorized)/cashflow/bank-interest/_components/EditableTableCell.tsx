import { useEffect, useState } from 'react';
import { NumericFormat } from 'react-number-format';
import clsx from 'clsx';

import { ImSpinner2 } from 'react-icons/im';
import { inputStyles, buttonStyles, colorStyles } from '@/styles/theme';
import { stylingUtils } from '@/styles/styling';

type EditableTableCellProps = {
  inProgress?: boolean;
  originalValue: number | null;
  OnValueChange: (value: number | null) => void;
};

export default function EditableTableCell({
  inProgress = false,
  originalValue,
  OnValueChange,
}: EditableTableCellProps) {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [value, setValue] = useState(() => originalValue);

  useEffect(() => {
    setIsEditing(originalValue !== value);
  }, [originalValue, value]);

  return (
    <div className='flex flex-row items-center gap-2'>
      <NumericFormat
        className={stylingUtils.overrideClasses(
          inputStyles.base,
          { bg: 'bg-white' }, // Override bg-gray-50 with bg-white
        )}
        prefix='$'
        displayType='input'
        thousandSeparator
        value={value}
        disabled={inProgress}
        onValueChange={(values) => setValue(values.floatValue || 0)}
      />
      <div className='flex items-center min-w-[5rem]'>
        {inProgress && (
          <ImSpinner2
            className={clsx('animate-spin', colorStyles.primary.text)}
          />
        )}
        {isEditing && !inProgress && (
          <div className='flex gap-1'>
            <button
              type='button'
              className={clsx(
                buttonStyles.iconSmall,
                'text-xs',
                colorStyles.primary.bg,
                'text-white',
                colorStyles.primary.hover.bg,
                'hover:text-white',
                colorStyles.primary.focus,
              )}
              onClick={() => OnValueChange(value)}
              aria-label='Save changes'
            >
              ✓
            </button>
            <button
              type='button'
              className={clsx(
                buttonStyles.iconSmall,
                'text-xs',
                'bg-orange-100 text-orange-600 border border-orange-200',
                'hover:bg-orange-200 hover:text-orange-800',
                'focus:ring-orange-500',
              )}
              onClick={() => setValue(originalValue)}
              aria-label='Cancel changes'
            >
              ↩
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
