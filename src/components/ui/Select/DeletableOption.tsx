import { Loader2 } from 'lucide-react';
import type { OptionProps } from 'react-select';
import { components } from 'react-select';

import { DeleteIcon } from './DeleteIcon';

interface DeletableOptionProps<T> extends OptionProps<T, false> {
  onDelete: () => void;
  isPending: boolean;
}

export function DeletableOption<T>(props: DeletableOptionProps<T>) {
  const { onDelete, isPending, ...optionProps } = props;

  return (
    <div className='flex items-center justify-between'>
      <components.Option {...optionProps} />
      {isPending ? (
        <Loader2 className='animate-spin' />
      ) : (
        <DeleteIcon onClick={onDelete} />
      )}
    </div>
  );
}
