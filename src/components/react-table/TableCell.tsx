import { NumericFormat } from 'react-number-format';
import { useState, useEffect, useId } from 'react';
import Select from 'react-select';

import DatePickerDialog from '../DatePickerDialog';
import { tableCellStyles } from '@/styles/theme';
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
    value: TValue,
  ) => {
    const updatedRecord: TData = {
      ...editedRecord,
      [propName]: value,
    };

    tableMeta?.setEditedRows(
      produce((draft) => {
        draft.set(row.index, castDraft(updatedRecord));
      }),
    );
  };

  const editedRecord = tableMeta?.editedRows.get(row.index);
  const value = editedRecord ? editedRecord[columnMeta.propName] : initialValue;
  let controlRenderer: Record<ControlType, () => React.JSX.Element | null>;
  if (editedRecord) {
    controlRenderer = {
      INPUT: () => <span>input jsx</span>,
      SELECT: () => {
        // const selectValue = value as PropsValue<OptionType> | undefined;
        const selectValue = columnMeta?.selectOptions?.find(
          (o) => o.id === editedRecord[columnMeta.propName],
        );
        return (
          <div className={tableCellStyles.select.container}>
            <Select
              isClearable
              instanceId={uniqSelectId}
              value={selectValue}
              options={columnMeta.selectOptions || []}
              getOptionValue={(option: OptionType) => option.id}
              menuPortalTarget={document.body}
              className={tableCellStyles.select.base}
              classNamePrefix='react-select'
              styles={{
                menuPortal: (base) =>
                  ({ ...base, zIndex: 9999 }) as typeof base,
                control: (base, state) =>
                  ({
                    ...base,
                    minHeight: '32px',
                    fontSize: '0.875rem',
                    borderColor: state.isFocused ? '#14b8a6' : '#d1d5db',
                    boxShadow: state.isFocused ? '0 0 0 1px #14b8a6' : 'none',
                    '&:hover': {
                      borderColor: '#14b8a6',
                    },
                  }) as typeof base,
                menu: (base) =>
                  ({
                    ...base,
                    zIndex: 9999,
                  }) as typeof base,
              }}
              onChange={(option) => {
                if (option)
                  updateRecord(
                    editedRecord,
                    columnMeta.propName,
                    option.id as TValue,
                  );
              }}
            />
          </div>
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
          className={tableCellStyles.input.amount}
          itemRef=''
          prefix='$'
          displayType='input'
          thousandSeparator
          value={value as number}
          onValueChange={(values) =>
            updateRecord(
              editedRecord,
              columnMeta.propName,
              (values.floatValue || 0) as TValue,
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
