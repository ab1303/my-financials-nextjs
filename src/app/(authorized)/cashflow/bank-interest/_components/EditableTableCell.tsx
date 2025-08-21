import { useEffect, useState } from 'react';
import { NumericFormat } from 'react-number-format';

import { ImSpinner2 } from 'react-icons/im';

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
  const [hasValueChanged, setHasValueChanged] = useState<boolean>(false);
  const [value, setValue] = useState(() => originalValue);

  useEffect(() => {
    setHasValueChanged(originalValue !== value);
  }, [originalValue, value]);

  return (
    <div className='flex flex-row items-center'>
      <NumericFormat
        className='w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:border-teal-500 focus:ring-1 focus:ring-teal-500'
        itemRef=''
        prefix='$'
        displayType='input'
        thousandSeparator
        value={value}
        disabled={inProgress}
        onValueChange={(values) => setValue(values.floatValue || 0)}
      />
      <span className='flex items-center ml-2 w-20'>
        {inProgress && <ImSpinner2 className='animate-spin text-teal-500' />}
        {hasValueChanged && (
          <>
            <button
              type='button'
              className='w-6 h-6 rounded-full text-xs mx-1 bg-green-100 text-green-600 hover:bg-green-200 hover:text-green-800 border border-green-200'
              onClick={() => OnValueChange(value)}
            >
              ✓
            </button>
            <button
              type='button'
              className='w-6 h-6 rounded-full text-xs bg-orange-100 text-orange-600 hover:bg-orange-200 hover:text-orange-800 border border-orange-200'
              onClick={() => setValue(originalValue)}
            >
              ↩
            </button>
          </>
        )}
      </span>
    </div>
  );
}
