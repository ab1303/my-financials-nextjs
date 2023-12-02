import { NumericFormat } from 'react-number-format';
import { useState, useEffect, ChangeEvent, useId } from 'react';
import type { PropsValue } from 'react-select';
import Select from 'react-select';

import DatePickerDialog from '../DatePickerDialog';
import type { CellContext, RowData } from '@tanstack/react-table';
import type { ReactNode } from 'react';

import type { OptionType } from '@/types';

type ControlType = 'SELECT' | 'DATE' | 'INPUT' | 'AMOUNT';

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    type?: ControlType;
    required?: boolean;
    pattern?: string;
    selectOptions?: Array<OptionType>;
  }
}

type TableCellProps<TData, TValue> = {
  table: CellContext<TData, TValue>['table'];
  row: CellContext<TData, TValue>['row'];
  column: CellContext<TData, TValue>['column'];
  getValue: CellContext<TData, TValue>['getValue'];
};

export const TableCell = <TData, TValue>({
  getValue,
  row,
  column,
  table,
}: TableCellProps<TData, TValue>) => {
  const initialValue = getValue();
  const columnMeta = column.columnDef.meta;
  const tableMeta = table.options.meta;
  const [value, setValue] = useState<unknown>(initialValue);
  const uniqSelectId = useId();
  const [validationMessage, setValidationMessage] = useState('');

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const editControlRenderer: Record<ControlType, () => JSX.Element | null> = {
    INPUT: () => <span>input jsx</span>,
    SELECT: () => {
      const selectValue = value as PropsValue<OptionType> | undefined;
      return (
        <Select
          isClearable
          defaultMenuIsOpen
          instanceId={uniqSelectId}
          value={selectValue}
          styles={{
            control: (base) => ({
              ...base,
              zIndex: 32,
            }),
          }}
          options={columnMeta?.selectOptions || []}
          getOptionValue={(option: OptionType) => option.id}
          onChange={(option) => {
            // setSelectedYear(option);
          }}
        />
      );
    },
    DATE: () => (
      <DatePickerDialog
        selectedDate={value as Date}
        onDateChange={(d) => setValue(d)}
      />
    ),
    AMOUNT: () => (
      <NumericFormat
        itemRef=''
        prefix='$'
        displayType='input'
        thousandSeparator
        value={value as number}
        onValueChange={(values) => setValue(values.floatValue || 0)}
      />
    ),
  };

  const displayControlRenderer: Record<
    ControlType,
    () => JSX.Element | null
  > = {
    INPUT: () => <span>input jsx</span>,
    SELECT: () => <span>{value as ReactNode}</span>,
    DATE: () => <>{(value as Date).toDateString()}</>,
    AMOUNT: () => (
      <NumericFormat
        itemRef=''
        prefix='$'
        displayType='text'
        thousandSeparator
        value={value as number}
        onValueChange={(values) => setValue(values.floatValue || 0)}
      />
    ),
  };

  // const onBlur = (e: ChangeEvent<HTMLInputElement>) => {
  //   displayValidationMessage(e);
  //   tableMeta?.updateData(row.index, column.id, value, e.target.validity.valid);
  // };

  // const onSelectChange = (e: ChangeEvent<HTMLSelectElement>) => {
  //   displayValidationMessage(e);
  //   setValue(e.target.value);
  //   tableMeta?.updateData(row.index, column.id, e.target.value, e.target.validity.valid);
  // };

  // if (tableMeta?.editedRows[row.id]) {
  //   return columnMeta?.type === "select" ? (
  //     <select
  //       onChange={onSelectChange}
  //       value={initialValue}
  //       required={columnMeta?.required}
  //       title={validationMessage}
  //     >
  //       {columnMeta?.options?.map((option: Option) => (
  //         <option key={option.value} value={option.value}>
  //           {option.label}
  //         </option>
  //       ))}
  //     </select>
  //   ) : ;
  // }
  // return <span>{value}</span>;
  let renderedControl: JSX.Element | null;
  if (!tableMeta?.editedRows[row.id]) {
    renderedControl = columnMeta?.type ? (
      displayControlRenderer[columnMeta.type]()
    ) : (
      <span>{value as ReactNode}</span>
    );

    return <>{renderedControl}</>;
  }

  renderedControl = columnMeta?.type ? (
    editControlRenderer[columnMeta.type]()
  ) : (
    <span>default control</span>
  );

  return <>{renderedControl}</>;
};
