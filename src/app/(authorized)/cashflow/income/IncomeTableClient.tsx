'use client';

import { enableMapSet } from 'immer';

enableMapSet();

import { useMemo, useTransition } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useIncomeEntryState } from './StateProvider';
import SourceBreakdownWidget from './_components/SourceBreakdownWidget';
import MonthAccordionPanel from './_components/MonthAccordionPanel';

import type { ServerActionType, IncomeEntryType } from './_types';
import type {
  CreateIncomeEntryInput,
  UpdateIncomeEntryInput,
  DeleteIncomeEntryInput,
} from './_schema';

type IncomeTableClientProps = {
  editRow: (input: UpdateIncomeEntryInput) => Promise<ServerActionType>;
  addRow: (
    input: CreateIncomeEntryInput,
  ) => Promise<ServerActionType<IncomeEntryType>>;
  deleteRow: (input: DeleteIncomeEntryInput) => Promise<ServerActionType>;
  calendarYearId: string;
};

type MonthGroup = {
  key: string;
  label: string;
  subtotal: number;
  entries: Array<{ entry: IncomeEntryType; originalIndex: number }>;
};

export function groupByMonth(entries: IncomeEntryType[]): MonthGroup[] {
  const map = new Map<string, MonthGroup>();
  entries.forEach((entry, originalIndex) => {
    const d = new Date(entry.dateEarned);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
    if (!map.has(key)) map.set(key, { key, label, subtotal: 0, entries: [] });
    const group = map.get(key)!;
    group.subtotal += entry.amount;
    group.entries.push({ entry, originalIndex });
  });
  return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
}

export default function IncomeTableClient({
  addRow,
  editRow,
  deleteRow,
  calendarYearId,
}: IncomeTableClientProps) {
  const [isPending, startTransition] = useTransition();

  const {
    state: { data },
    dispatch,
  } = useIncomeEntryState();

  // Compute current month key for auto-expanding the current month
  const nowKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // Group entries by month
  const monthGroups = useMemo(() => groupByMonth(data), [data]);

  // Handle adding entry to the current month
  const handleGlobalAddEntry = async () => {
    if (!calendarYearId) {
      toast.error('Please select a fiscal year first');
      return;
    }
    const tempId = `temp-${Date.now()}`;
    const newRow: IncomeEntryType = {
      id: tempId,
      dateEarned: new Date(),
      amount: 0,
      incomeSourceId: '',
      incomeSourceName: '',
      incomeLedgerId: '',
    };
    dispatch({ type: 'INCOME/Entries/ADD_ENTRY', payload: { incomeEntryId: tempId, entry: newRow } });
    toast.info('New income row added. Fill in the details and save.');
  };

  return (
    <div className='relative overflow-auto'>
      {/* Global Add Entry Button */}
      <div className='flex justify-end mb-3'>
        <Button
          variant='default'
          onClick={handleGlobalAddEntry}
          disabled={isPending}
          aria-label='Add new income entry'
        >
          <Plus className='w-4 h-4' />
          Add Entry
        </Button>
      </div>

      {/* Source Breakdown Widget */}
      {data.length > 0 && <SourceBreakdownWidget entries={data} />}

      {/* Empty State */}
      {monthGroups.length === 0 && (
        <div className='text-center py-8'>
          <p className='text-muted-foreground'>No income entries yet. Add one to get started.</p>
        </div>
      )}

      {/* Monthly Accordion Panels */}
      {monthGroups.length > 0 && (
        <div className='space-y-1 mt-3'>
          {monthGroups.map((group) => (
            <MonthAccordionPanel
              key={group.key}
              monthKey={group.key}
              label={group.label}
              subtotal={group.subtotal}
              entryCount={group.entries.length}
              entries={group.entries.map((e) => e.entry)}
              calendarYearId={calendarYearId}
              addRow={addRow}
              editRow={editRow}
              deleteRow={deleteRow}
              defaultOpen={group.key === nowKey}
            />
          ))}
        </div>
      )}
    </div>
  );
}

