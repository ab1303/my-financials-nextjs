'use client';

import { useState, useMemo, useTransition } from 'react';
import { useDebounce } from 'usehooks-ts';
import { trpc } from '@/lib/trpc/client';
import { type Candidate } from '@/server/services/bank-interest/interest-cleansing.service';

interface CleansingCandidatePickerProps {
  creditId: string;
  bankAccountId?: string;
  onSelect: (candidate: Candidate) => void;
}

export function CleansingCandidatePicker({
  creditId,
  bankAccountId,
  onSelect,
}: CleansingCandidatePickerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [isPending, startTransition] = useTransition();

  const { data: candidates, isLoading } = trpc.getCleansingDebitCandidates.useQuery(
    {
      creditId,
      bankAccountId,
      search: debouncedSearch,
    },
    {
      placeholderData: (previousData) => previousData, // Keeps previous data while fetching new
    }
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    startTransition(() => {
      setSearchTerm(value);
    });
  };

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search candidates..."
        value={searchTerm}
        onChange={handleSearchChange}
        className="w-full rounded border p-2"
      />

      {isLoading && <p>Loading candidates...</p>}

      {candidates && (
        <ul className="space-y-2">
          {candidates.map((candidate) => (
            <li
              key={candidate.transactionId}
              onClick={() => onSelect(candidate)}
              className="cursor-pointer rounded border p-3 hover:bg-gray-50"
            >
              <div className="flex justify-between">
                <span>{candidate.date}</span>
                <span className="font-bold">${candidate.amount.toFixed(2)}</span>
              </div>
              <p className="text-sm text-gray-600">{candidate.description}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                  Score: {candidate.score}
                </span>
                <span className="text-xs text-gray-500">{candidate.reasonShort}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
