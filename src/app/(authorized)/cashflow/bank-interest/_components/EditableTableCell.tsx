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
    <div className='flex flex-row'>
      <NumericFormat
        itemRef=''
        prefix='$'
        displayType='input'
        thousandSeparator
        value={value}
        disabled={inProgress}
        onValueChange={(values) => setValue(values.floatValue || 0)}
      />
      <span className='flex flex-wrap content-center mx-1 w-32'>
        {inProgress && <ImSpinner2 className='animate-spin' />}
        {hasValueChanged && (
          <>
            <button
              type='button'
              className='w-7 h-7 rounded-full text-xs mx-1 bg-gray-200 text-green-500 hover:text-green-800 border-gray-100'
              onClick={() => OnValueChange(value)}
            >
              ✔
            </button>
            <button
              type='button'
              className='w-7 h-7 rounded-full text-xs bg-gray-200 text-orange-300 hover:text-orange-500 border-gray-100'
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
