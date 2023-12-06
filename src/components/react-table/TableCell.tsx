import { NumericFormat } from 'react-number-format';
import { useState, useEffect, useId } from 'react';
import Select from 'react-select';

import DatePickerDialog from '../DatePickerDialog';
import type { CellContext, RowData } from '@tanstack/react-table';
import type { ReactNode } from 'react';

import type { OptionType } from '@/types';
import { castDraft, produce } from 'immer';

type ControlType = 'SELECT' | 'DATE' | 'INPUT' | 'AMOUNT';

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    type?: ControlType;
    propName: keyof TData;
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
  const uniqSelectId = useId();
  const [validationMessage, setValidationMessage] = useState('');

  // const [value, setValue] = useState<unknown>(initialValue);
  useEffect(() => {
    // setValue(initialValue);
  }, [initialValue]);

  if (!columnMeta) return <span>set up control</span>;

  const updateRecord = (
    editedRecord: TData,
    propName: keyof TData,
    value: TValue
  ) => {
    const updatedRecord: TData = {
      ...editedRecord,
      [propName]: value,
    };

    tableMeta?.setEditedRows(
      produce((draft) => {
        draft.set(row.id, castDraft(updatedRecord));
      })
    );
  };

  const editedRecord = tableMeta?.editedRows.get(row.id);
  const value = editedRecord ? editedRecord[columnMeta.propName] : initialValue;
  let controlRenderer: Record<ControlType, () => JSX.Element | null>;
  if (editedRecord) {
    controlRenderer = {
      INPUT: () => <span>input jsx</span>,
      SELECT: () => {
        // const selectValue = value as PropsValue<OptionType> | undefined;
        const selectValue = columnMeta?.selectOptions?.find(
          (o) => o.id === editedRecord[columnMeta.propName]
        );
        return (
          <Select
            isClearable
            instanceId={uniqSelectId}
            value={selectValue}
            options={columnMeta.selectOptions || []}
            getOptionValue={(option: OptionType) => option.id}
            onChange={(option) => {
              if (option)
                updateRecord(
                  editedRecord,
                  columnMeta.propName,
                  option.id as TValue
                );
            }}
          />
        );
      },
      DATE: () => (
        <DatePickerDialog
          selectedDate={value as Date}
          onDateChange={(d) =>
            updateRecord(editedRecord, columnMeta.propName, d as TValue)
          }
        />
      ),
      AMOUNT: () => (
        <NumericFormat
          itemRef=''
          prefix='$'
          displayType='input'
          thousandSeparator
          value={value as number}
          onValueChange={(values) =>
            updateRecord(
              editedRecord,
              columnMeta.propName,
              (values.floatValue || 0) as TValue
            )
          }
        />
      ),
    };
  } else {
    controlRenderer = {
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
        />
      ),
    };
  }

  const renderedControl = columnMeta?.type ? (
    controlRenderer[columnMeta.type]()
  ) : (
    <span>{value as ReactNode}</span>
  );

  return <>{renderedControl}</>;
  // const onBlur = (e: ChangeEvent<HTMLInputElement>) => {
  //   displayValidationMessage(e);
  //   tableMeta?.updateData(row.index, column.id, value, e.target.validity.valid);
  // };

  // const onSelectChange = (e: ChangeEvent<HTMLSelectElement>) => {
  //   displayValidationMessage(e);
  //   setValue(e.target.value);
  //   tableMeta?.updateData(row.index, column.id, e.target.value, e.target.validity.valid);
  // };
};
