'use client';

import { useState } from 'react';
import { toast } from 'react-toastify';
import CalendarForm from './form';
import CalendarTableClient from './CalendarTableClient';
import type { CalendarYearType } from './_types';
import type { FormInput } from './_schema';
import type { ServerActionType } from './_types';

type CalendarClientWrapperProps = {
  tableData: CalendarYearType[];
  upsertCalendarYear: (formData: FormInput) => Promise<ServerActionType>;
  deleteCalendarYear: (id: string) => Promise<ServerActionType>;
};

export default function CalendarClientWrapper({
  tableData,
  upsertCalendarYear,
  deleteCalendarYear,
}: CalendarClientWrapperProps) {
  const [editingRecord, setEditingRecord] = useState<CalendarYearType | null>(
    null,
  );

  const handleEdit = (record: CalendarYearType) => {
    setEditingRecord(record);
  };

  const handleDelete = async (record: CalendarYearType) => {
    const result = await deleteCalendarYear(record.id);
    if (result.success) {
      toast.success('Calendar year deleted successfully!');
      // Clear editing state if we're deleting the currently edited record
      if (editingRecord?.id === record.id) {
        setEditingRecord(null);
      }
    } else {
      // Show specific error message for referential integrity violations
      if (result.isReferentialIntegrityError && result.error) {
        toast.error(result.error);
      } else {
        toast.error(result.error || 'Failed to delete calendar year');
      }
    }
  };

  return (
    <>
      <CalendarForm
        upsertCalendarYear={upsertCalendarYear}
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
