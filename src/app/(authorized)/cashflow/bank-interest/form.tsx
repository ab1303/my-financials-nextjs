'use client';

import clsx from 'clsx';
import type { SingleValue } from 'react-select';
import Select from 'react-select';
import type { OptionType } from '@/types';
import { useState } from 'react';

type BankInterestFormProps = {
  initialData: {
    bankOptions: OptionType[];
  };
};

export default function BankInterestForm(props: BankInterestFormProps) {
  const {
    initialData: { bankOptions },
  } = props;

  const [selectedBank, setSelectedBank] = useState<
    SingleValue<OptionType> | undefined
  >();

  const handleOptionChange = (option: SingleValue<OptionType>) => {
    if (!option) {
      setSelectedBank(null);
      return;
    }

    if (option.id) {
      setSelectedBank(option);
    }

    return;
  };

  return (
    <div>
      <label className={clsx('block text-sm font-medium ')}>Bank</label>
      <div className='mt-1'>
        <Select
          isClearable
          className='w-3/5 mr-2'
          value={selectedBank}
          options={bankOptions}
          onChange={(option) => handleOptionChange(option)}
        />
      </div>
    </div>
  );
}
