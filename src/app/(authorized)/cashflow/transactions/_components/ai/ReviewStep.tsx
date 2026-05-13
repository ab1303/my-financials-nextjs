'use client';

import { useState } from 'react';
import ConfidenceBadge from './ConfidenceBadge';
import type { ReviewStepProps } from './_types';

export default function ReviewStep({
  sessionId,
  extractedImages,
  categories,
  calendarYearId,
  month,
  bankAccountId,
  onConfirm,
  onBack,
  isConfirming,
}: ReviewStepProps) {
  const [localImages, setLocalImages] = useState(extractedImages);

  const toggleEntry = (imageIdx: number, entryIdx: number) => {
    setLocalImages((prev) =>
      prev.map((img, ii) => {
        if (ii !== imageIdx) return img;
        return {
          ...img,
          entries: img.entries.map((e, ei) =>
            ei === entryIdx ? { ...e, confirmed: !e.confirmed } : e,
          ),
        };
      }),
    );
  };

  const updateAmount = (imageIdx: number, entryIdx: number, amount: number) => {
    setLocalImages((prev) =>
      prev.map((img, ii) => {
        if (ii !== imageIdx) return img;
        return {
          ...img,
          entries: img.entries.map((e, ei) =>
            ei === entryIdx ? { ...e, amount } : e,
          ),
        };
      }),
    );
  };

  const updateCategory = (
    imageIdx: number,
    entryIdx: number,
    categoryName: string,
  ) => {
    setLocalImages((prev) =>
      prev.map((img, ii) => {
        if (ii !== imageIdx) return img;
        return {
          ...img,
          entries: img.entries.map((e, ei) =>
            ei === entryIdx ? { ...e, categoryName } : e,
          ),
        };
      }),
    );
  };

  const handleConfirmAndSave = async () => {
    const res = await fetch('/api/transactions/ai/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        calendarYearId,
        month,
        bankAccountId: bankAccountId || undefined,
        images: localImages.map((img) => ({
          imageId: img.imageId,
          entries: img.entries.map((e) => ({
            categoryName: e.categoryName,
            amount: e.amount,
            confirmed: e.confirmed,
          })),
        })),
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error ?? 'Confirm failed');
    }

    const data = await res.json();
    onConfirm({
      sessionId: data.sessionId,
      recordsCreated: data.recordsCreated,
      status: data.status,
    });
  };

  const totalConfirmed = localImages.reduce(
    (s, img) => s + img.entries.filter((e) => e.confirmed).length,
    0,
  );

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h3 className='text-base font-semibold text-gray-900'>
          Review Extracted Data
        </h3>
        <span className='text-xs text-gray-500'>
          {totalConfirmed} entries to import
        </span>
      </div>

      {localImages.map((img, imageIdx) => (
        <div key={img.imageId} className='border border-gray-200 rounded-lg p-4'>
          <div className='flex items-center justify-between mb-3'>
            <div className='flex items-center gap-2'>
              <span className='text-sm font-medium text-gray-800 truncate max-w-[200px]'>
                {img.fileName || img.imageId}
              </span>
              <ConfidenceBadge score={img.confidence} />
            </div>
          </div>

          {img.entries.length === 0 ? (
            <p className='text-xs text-gray-400'>No entries extracted</p>
          ) : (
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b border-gray-100'>
                  <th className='text-left py-1.5 pr-3 w-8'></th>
                  <th className='text-left py-1.5 pr-3 text-xs text-gray-500 font-medium'>
                    Category
                  </th>
                  <th className='text-right py-1.5 text-xs text-gray-500 font-medium'>
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {img.entries.map((entry, entryIdx) => (
                  <tr
                    key={entry.id}
                    className={`border-b border-gray-50 ${!entry.confirmed ? 'opacity-50' : ''}`}
                  >
                    <td className='py-1.5 pr-3'>
                      <input
                        type='checkbox'
                        checked={entry.confirmed}
                        onChange={() => toggleEntry(imageIdx, entryIdx)}
                        className='rounded'
                      />
                    </td>
                    <td className='py-1.5 pr-3'>
                      <select
                        value={entry.categoryName}
                        onChange={(e) =>
                          updateCategory(imageIdx, entryIdx, e.target.value)
                        }
                        disabled={!entry.confirmed}
                        className='w-full text-xs border-0 bg-transparent focus:ring-0 focus:border-b focus:border-teal-500'
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                        <option value={entry.categoryName}>
                          {entry.categoryName}
                        </option>
                      </select>
                    </td>
                    <td className='py-1.5 text-right'>
                      <input
                        type='number'
                        value={entry.amount}
                        onChange={(e) =>
                          updateAmount(
                            imageIdx,
                            entryIdx,
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        disabled={!entry.confirmed}
                        className='w-24 text-right text-xs border-0 bg-transparent focus:ring-0 focus:border-b focus:border-teal-500'
                        step='0.01'
                        min='0'
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}

      <div className='flex justify-between pt-2'>
        <button
          onClick={onBack}
          disabled={isConfirming}
          className='text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50'
        >
          ← Back
        </button>
        <button
          onClick={handleConfirmAndSave}
          disabled={isConfirming || totalConfirmed === 0}
          className='px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 text-sm font-medium'
        >
          {isConfirming ? 'Saving…' : `Confirm & Save (${totalConfirmed} entries)`}
        </button>
      </div>
    </div>
  );
}
