'use client';

import { useEffect, useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import type { UploadedFile, AIImportSessionResult } from '../../../cashflow/transactions/_components/ai/_types';

interface BankAIProcessingStepProps {
  files: UploadedFile[];
  snapshotDate: string;
  onComplete: (result: AIImportSessionResult) => void;
}

export default function BankAIProcessingStep({
  files,
  snapshotDate,
  onComplete,
}: BankAIProcessingStepProps) {
  const [status, setStatus] = useState('Uploading images…');
  const [error, setError] = useState<string | null>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const run = async () => {
      try {
        // 1. Upload images
        setStatus('Uploading images…');
        const formData = new FormData();
        files.forEach((f) => formData.append('files', f.file));

        const uploadRes = await fetch('/api/transactions/ai/upload', {
          method: 'POST',
          body: formData,
        });
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}));
          throw new Error(err.error ?? 'Upload failed');
        }
        const uploadData = await uploadRes.json() as { imageIds: string[]; images: Array<{ imageId: string; fileName: string }> };

        // 2. Parse/extract via SSE
        setStatus('Extracting data with AI…');
        const parseRes = await fetch('/api/transactions/ai/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageIds: uploadData.imageIds }),
        });
        if (!parseRes.ok) {
          const err = await parseRes.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error ?? 'Parse failed');
        }

        // Drain SSE stream to get sessionId
        const reader = parseRes.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let sessionId = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() ?? '';
          for (const chunk of chunks) {
            const line = chunk.trim();
            if (!line.startsWith('data: ')) continue;
            try {
              const evt = JSON.parse(line.slice(6)) as Record<string, unknown>;
              if (evt.type === 'complete') {
                sessionId = (evt.sessionId as string) ?? '';
              }
            } catch {
              // ignore parse errors
            }
          }
        }

        if (!sessionId) {
          throw new Error('No session ID returned from parse');
        }

        // 3. Auto-confirm (no review step for bank assets)
        setStatus('Saving extracted data…');
        const confirmRes = await fetch('/api/transactions/ai/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            // Bank asset imports don't use calendarYearId or month
            calendarYearId: '',
            month: 0,
            importType: 'BANK_ASSET',
            snapshotDate,
            images: [],  // Auto-confirm all extracted entries
          }),
        });
        if (!confirmRes.ok) {
          const err = await confirmRes.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error ?? 'Confirm failed');
        }
        const confirmData = await confirmRes.json() as { sessionId: string; recordsCreated: number; status: 'COMPLETED' | 'PARTIAL' | 'FAILED' };

        onComplete({
          sessionId: confirmData.sessionId,
          recordsCreated: confirmData.recordsCreated,
          status: confirmData.status,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Processing failed';
        setError(message);
      }
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className='flex flex-col items-center justify-center py-12 text-center'>
        <p className='text-sm font-semibold text-red-600 mb-2'>Processing Failed</p>
        <p className='text-xs text-red-500'>{error}</p>
      </div>
    );
  }

  return (
    <div className='flex flex-col items-center justify-center py-12 text-center'>
      <Loader2 className='h-10 w-10 animate-spin text-teal-600 mb-4' />
      <p className='text-sm font-medium text-gray-700'>{status}</p>
      <p className='mt-2 text-xs text-gray-400'>Processing {files.length} image{files.length !== 1 ? 's' : ''}…</p>
    </div>
  );
}
