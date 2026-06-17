import { NumericFormat } from 'react-number-format';
import { tableCellStyles } from '@/styles/theme';

interface AmountCellProps {
  value: number;
  onChange: (value: number) => void;
  isEditing: boolean;
}

export const AmountCell = ({ value, onChange, isEditing }: AmountCellProps) => {
  if (isEditing) {
    return (
      <NumericFormat
        className={tableCellStyles.input.amount}
        prefix='$'
        displayType='input'
        thousandSeparator
        value={value}
        onValueChange={(values) => onChange(values.floatValue || 0)}
      />
    );
  }

  return (
    <div className='text-right'>
      {new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
      }).format(value)}
    </div>
  );
};
