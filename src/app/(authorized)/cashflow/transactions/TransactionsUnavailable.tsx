'use client';

import { useRouter } from 'next/navigation';

interface TransactionsUnavailableProps {
  title?: string;
  message?: string;
}

export default function TransactionsUnavailable({
  title = 'Page unavailable',
  message = 'The page is not available right now. Please try again later.',
}: TransactionsUnavailableProps) {
  const router = useRouter();

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-6 dark:border-yellow-800 dark:bg-yellow-900/20">
        <h1 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100">
          {title}
        </h1>
        <p className="mt-2 text-sm text-yellow-800 dark:text-yellow-200">
          {message}
        </p>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="mt-4 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700"
        >
          Retry
        </button>
      </div>
    </main>
  );
}
