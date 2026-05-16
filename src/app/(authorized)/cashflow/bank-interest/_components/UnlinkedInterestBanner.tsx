'use client';


type UnlinkedInterestBannerProps = {
  unlinkedCount: number;
  onCleanse?: () => void;
};

export default function UnlinkedInterestBanner({
  unlinkedCount,
  onCleanse,
}: UnlinkedInterestBannerProps) {
  if (unlinkedCount === 0) return null;

  return (
    <div className='mb-4 flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950'>
      <p className='text-sm text-amber-800 dark:text-amber-200'>
        🔗 <strong>{unlinkedCount}</strong> bank interest transaction
        {unlinkedCount !== 1 ? 's' : ''} need cleansing.
      </p>
      <button
        type='button'
        onClick={() => onCleanse?.()}
        className='rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600'
      >
        Cleanse Now
      </button>
    </div>
  );
}
