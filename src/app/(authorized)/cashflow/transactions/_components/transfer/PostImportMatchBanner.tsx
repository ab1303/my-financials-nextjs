'use client';

interface PostImportMatchBannerProps {
  importSessionId: string;
  autoLinkedCount: number;
  flaggedCount: number;
  onReviewFlagged?: () => void;
  onDismiss: () => void;
}

export default function PostImportMatchBanner({
  importSessionId,
  autoLinkedCount,
  flaggedCount,
  onReviewFlagged,
  onDismiss,
}: PostImportMatchBannerProps) {
  if (autoLinkedCount === 0 && flaggedCount === 0) return null;

  function handleDismiss() {
    try {
      localStorage.setItem(`post-import-banner-${importSessionId}`, 'dismissed');
    } catch {}
    onDismiss();
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 dark:border-teal-700 dark:bg-teal-900/20">
      <div className="flex flex-wrap items-center gap-3">
        {autoLinkedCount > 0 && (
          <span className="text-sm text-teal-800 dark:text-teal-200">
            ✅ {autoLinkedCount} transfer{autoLinkedCount > 1 ? 's' : ''} auto-linked
          </span>
        )}
        {flaggedCount > 0 && (
          <span className="text-sm text-amber-700 dark:text-amber-300">
            ⚠️ {flaggedCount} pair{flaggedCount > 1 ? 's' : ''} need review
          </span>
        )}
        {flaggedCount > 0 && onReviewFlagged && (
          <button
            type="button"
            onClick={onReviewFlagged}
            className="text-sm font-medium text-teal-700 hover:underline dark:text-teal-300"
          >
            Review →
          </button>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={handleDismiss}
        className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        ✕
      </button>
    </div>
  );
}
