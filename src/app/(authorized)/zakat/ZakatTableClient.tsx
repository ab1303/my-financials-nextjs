'use client';

import { useState } from 'react';
import { NumericFormat } from 'react-number-format';
import {
  useReactTable,
  createColumnHelper,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';
import { toast } from 'react-toastify';

import Table from '@/components/table';
import MONTHS_MAP from '@/constants/map';
import { trpcClient } from '@/server/trpc/client';
import { TRPCError } from '@trpc/server';

type BankInterestTableClientProps = {
  calendarYearId: string;
};

type EditedRowType = {
  rowIndex: number;
  updatedValue: number | null;
};

export default function BankInterestTableClient({
  calendarYearId,
}: BankInterestTableClientProps) {
  const [editedRows, setEditedRows] = useState<Map<string, EditedRowType>>(
    new Map()
  );

  const [selectedZakatPaymentId, setSelectedZakatPaymentId] = useState<
    string | null
  >(null);

  const updateEditRows = (id: string, record?: EditedRowType) => {
    setEditedRows((prev) => {
      const result = new Map(prev);
      if (!record) {
        result.delete(id);
      } else {
        result.set(id, record);
      }

      return result;
    });
  };

  return <>Zakat table client</>;
}
