'use client';

import { useState } from 'react';
import CalendarForm from './form';
import CalendarTableClient from './CalendarTableClient';
import type { CalendarYearType } from './_types';
import type { FormInput } from './_schema';
import type { ServerActionType } from './_types';

type CalendarClientWrapperProps = {
  tableData: CalendarYearType[];
  addCalendarYear: (formData: FormInput) => Promise<ServerActionType>;
};

export default function CalendarClientWrapper({
  tableData,
  addCalendarYear,
}: CalendarClientWrapperProps) {
  const [editingRecord, setEditingRecord] = useState<CalendarYearType | null>(
    null,
  );

  const handleEdit = (record: CalendarYearType) => {
    setEditingRecord(record);
  };

  const handleDelete = (record: CalendarYearType) => {
    // TODO: Implement delete functionality
    console.log('Delete record:', record);
  };

  return (
    <>
      <CalendarForm
        addCalendarYear={addCalendarYear}
        initialData={editingRecord || undefined}
        editingRecord={editingRecord}
        setEditingRecord={setEditingRecord}
      />
      <div className='font-mono text-gray-500 mt-12 mb-4'>Calendar year(s)</div>
      <CalendarTableClient
        tableData={tableData}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </>
  );
}
