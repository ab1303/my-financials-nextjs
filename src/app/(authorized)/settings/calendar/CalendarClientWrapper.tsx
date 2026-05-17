'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import CalendarForm from './form';
import CalendarTableClient from './CalendarTableClient';
import PastCalendarYears from './PastCalendarYears';
import type { CalendarYearType } from './_types';
import { isCurrentCalendarYear, groupByYearRange } from './_types';
import type { FormInput } from './_schema';
import type { ServerActionType } from './_types';
import { trpc } from '@/server/trpc/client';

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
  const router = useRouter();
  const [editingRecord, setEditingRecord] = useState<CalendarYearType | null>(
    null,
  );
  const lockMutation = trpc.calendarYear.lockYear.useMutation();
  const unlockMutation = trpc.calendarYear.unlockYear.useMutation();

  const { currentEntries, pastGroups } = useMemo(() => {
    const current: CalendarYearType[] = [];
    const past: CalendarYearType[] = [];

    for (const entry of tableData) {
      if (isCurrentCalendarYear(entry)) {
        current.push(entry);
      } else {
        past.push(entry);
      }
    }

    return {
      currentEntries: current,
      pastGroups: groupByYearRange(past),
    };
  }, [tableData]);

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

  const handleLock = async (record: CalendarYearType) => {
    try {
      await lockMutation.mutateAsync({ calendarYearId: record.id });
      toast.success('Fiscal year locked');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to lock fiscal year');
    }
  };

  const handleUnlock = async (record: CalendarYearType) => {
    try {
      await unlockMutation.mutateAsync({ calendarYearId: record.id });
      toast.success('Fiscal year unlocked');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to unlock fiscal year');
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
      <div className='font-mono text-gray-500 mt-12 mb-4'>
        Current calendar year(s)
      </div>
      {currentEntries.length > 0 ? (
        <CalendarTableClient
          tableData={currentEntries}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onLock={handleLock}
          onUnlock={handleUnlock}
        />
      ) : (
        <p className='text-sm text-gray-400 italic'>
          No active calendar years for the current period.
        </p>
      )}

      <PastCalendarYears
        groups={pastGroups}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onLock={handleLock}
        onUnlock={handleUnlock}
      />
    </>
  );
}
