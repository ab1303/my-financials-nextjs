'use client';

import { useEffect, useRef, useState } from 'react';

import type { ClassifiedCreditMonth } from '@/server/services/ai-import/_types';

import type { ClassifiedMonth, CSVClassifyingStepProps } from './_types';

interface ProgressEntry {
  month: string;
  status: 'pending' | 'classifying' | 'done' | 'error';
  transactionCount?: number;
}

export default function CSVClassifyingStep({
  file,
  context: _context,
  onComplete,
  onError,
}: CSVClassifyingStepProps) {
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [statusMessage, setStatusMessage] = useState('Connecting...');
  const classifiedMonthsRef = useRef<ClassifiedMonth[]>([]);
  const classifiedCreditMonthsRef = useRef<ClassifiedCreditMonth[]>([]);
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    if (hasCompletedRef.current) return;

    const abortController = new AbortController();

    async function startClassification() {
      try {
        const body = JSON.stringify({ fileId: file.id });
        const response = await fetch('/api/transactions/csv/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body,
          signal: abortController.signal,
        });

        if (!response.ok) {
          const err = await response
            .json()
            .catch(() => ({ error: 'Unknown error' }));
          onError(err.error ?? 'Classification failed');
          return;
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() ?? '';

          for (const chunk of lines) {
            const line = chunk.trim();
            if (!line.startsWith('data: ')) continue;

            let event: Record<string, unknown>;
            try {
              event = JSON.parse(line.slice(6)) as Record<string, unknown>;
            } catch {
              continue;
            }

            handleSSEEvent(event);
          }
        }
      } catch (err: unknown) {
        if ((err as { name?: string }).name === 'AbortError') return;
        onError('Connection interrupted during classification');
      }
    }

    function upsertProgress(
      month: string,
      updater: (entry?: ProgressEntry) => ProgressEntry,
    ) {
      // Replace any existing entry for the same month to avoid duplicate keys
      // in the rendered list when events arrive concurrently.
      setProgress((prev) => {
        const existing = prev.find((p) => p.month === month);
        const without = prev.filter((p) => p.month !== month);
        const nextEntry = updater(existing);
        return [...without, nextEntry];
      });
    }

    function handleSSEEvent(event: Record<string, unknown>) {
      const type = event.type as string;

      if (type === 'progress') {
        const month = event.month as string;
        setStatusMessage(`Classifying ${month}…`);
        upsertProgress(month, (entry) => ({
          month,
          status: 'classifying',
          transactionCount: entry?.transactionCount,
        }));
      } else if (type === 'debit_classified' || type === 'classified') {
        const month = event.month as string;
        const transactions = (event.transactions ?? []) as any[];
        const duplicates = (event.duplicates ?? []) as any[]; // Capture duplicates
        const usage = (event.usage ?? {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        }) as {
          promptTokens: number;
          completionTokens: number;
          totalTokens: number;
        };
        const classified: ClassifiedMonth = {
          month,
          transactions,
          duplicates, // Store duplicates
          totalUsage: usage,
        };
        // Merge with existing month if present so pre-matched (rule-match)
        // transactions are not overwritten by subsequent LLM results.
        const existingDebit = classifiedMonthsRef.current.find(
          (c) => c.month === month,
        );
        if (existingDebit) {
          // merge by id, preferring existing transaction object when ids collide
          const existingById = new Map(
            existingDebit.transactions.map((t) => [t.id, t]),
          );
          for (const tx of transactions) {
            if (!existingById.has(tx.id)) existingById.set(tx.id, tx);
          }
          const mergedTxs = Array.from(existingById.values());
          // Merge duplicates as well
          const mergedDuplicates = [...(existingDebit.duplicates ?? []), ...duplicates];
          const mergedUsage = {
            promptTokens:
              (existingDebit.totalUsage.promptTokens ?? 0) +
              (usage.promptTokens ?? 0),
            completionTokens:
              (existingDebit.totalUsage.completionTokens ?? 0) +
              (usage.completionTokens ?? 0),
            totalTokens:
              (existingDebit.totalUsage.totalTokens ?? 0) +
              (usage.totalTokens ?? 0),
          };
          const merged: ClassifiedMonth = {
            month,
            transactions: mergedTxs,
            duplicates: mergedDuplicates, // Merge duplicates
            totalUsage: mergedUsage,
          };
          classifiedMonthsRef.current = classifiedMonthsRef.current.map((c) =>
            c.month === month ? merged : c,
          );
        } else {
          classifiedMonthsRef.current = [
            ...classifiedMonthsRef.current,
            classified,
          ];
        }
        upsertProgress(month, () => ({
          month,
          status: 'done',
          transactionCount: transactions.length,
        }));
      } else if (type === 'credit_classified') {
        const month = event.month as string;
        const transactions = (event.transactions ?? []) as any[];
        const usage = (event.usage ?? {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        }) as {
          promptTokens: number;
          completionTokens: number;
          totalTokens: number;
        };
        // Upsert the classified credit month to avoid duplicate month entries
        const creditClassified = { month, transactions, totalUsage: usage };
        const existingCredit = classifiedCreditMonthsRef.current.find(
          (c) => c.month === month,
        );
        if (existingCredit) {
          const existingById = new Map(
            existingCredit.transactions.map((t) => [t.id, t]),
          );
          for (const tx of transactions) {
            if (!existingById.has(tx.id)) existingById.set(tx.id, tx);
          }
          const mergedTxs = Array.from(existingById.values());
          const mergedUsage = {
            promptTokens:
              (existingCredit.totalUsage.promptTokens ?? 0) +
              (usage.promptTokens ?? 0),
            completionTokens:
              (existingCredit.totalUsage.completionTokens ?? 0) +
              (usage.completionTokens ?? 0),
            totalTokens:
              (existingCredit.totalUsage.totalTokens ?? 0) +
              (usage.totalTokens ?? 0),
          };
          const merged = {
            month,
            transactions: mergedTxs,
            totalUsage: mergedUsage,
          } as ClassifiedCreditMonth;
          classifiedCreditMonthsRef.current =
            classifiedCreditMonthsRef.current.map((c) =>
              c.month === month ? merged : c,
            );
        } else {
          classifiedCreditMonthsRef.current = [
            ...classifiedCreditMonthsRef.current,
            creditClassified,
          ];
        }
        upsertProgress(month, () => ({
          month,
          status: 'done',
          transactionCount: transactions.length,
        }));
      } else if (type === 'warning') {
        const month = event.month as string;
        upsertProgress(month, (entry) => ({
          month,
          status: 'done',
          transactionCount: entry?.transactionCount,
        }));
      } else if (type === 'done') {
        hasCompletedRef.current = true;
        const cats = (event.categories ?? []) as Array<{
          id: string;
          name: string;
        }>;
        const incomeSrcLabels = (event.incomeSourceLabels ?? []) as string[];
        const model = (event.model as string) ?? 'gpt-4o-mini';
        setStatusMessage('Classification complete');
        onComplete(
          classifiedMonthsRef.current,
          classifiedCreditMonthsRef.current,
          cats,
          incomeSrcLabels,
          model,
        );
      } else if (type === 'error') {
        onError((event.message as string) ?? 'Classification error');
      }
    }

    void startClassification();

    return () => {
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = progress.length;
  const done = progress.filter((p) => p.status === 'done').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className='flex flex-col items-center justify-center py-8 text-center'>
      <div className='mb-4 h-12 w-12 animate-spin rounded-full border-4 border-teal-200 border-t-teal-600 dark:border-teal-800 dark:border-t-teal-400' />

      <p className='mb-6 text-sm font-medium text-gray-700 dark:text-gray-300'>
        {statusMessage}
      </p>

      {total > 0 && (
        <div className='w-full max-w-sm space-y-3'>
          <div className='h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700'>
            <div
              className='h-2 rounded-full bg-teal-500 transition-all duration-300'
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className='text-xs text-gray-500 dark:text-gray-400'>
            {done} / {total} months classified
          </p>

          <ul className='mt-3 space-y-1 text-left'>
            {progress.map((p) => (
              <li
                key={p.month}
                className='flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400'
              >
                {p.status === 'done' ? (
                  <span className='text-teal-500'>✓</span>
                ) : p.status === 'classifying' ? (
                  <span className='animate-pulse text-teal-400'>⋯</span>
                ) : (
                  <span className='text-gray-300 dark:text-gray-600'>○</span>
                )}
                <span>{p.month}</span>
                {p.transactionCount !== undefined && (
                  <span className='ml-auto text-gray-400 dark:text-gray-500'>
                    {p.transactionCount} txns
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className='mt-6 text-xs text-gray-400 dark:text-gray-500'>
        Classifying {file.rowCount} transactions with AI…
      </p>
    </div>
  );
}
