import { getCGTProjectionText } from '@/utils/stock-asset-calculations';

interface Props {
  buyDate: Date | null | undefined;
  snapshotDate?: Date;  // Default to today if not provided
}

export function CGTEligibilityWarning({ buyDate, snapshotDate }: Props) {
  const text = getCGTProjectionText(buyDate ?? null, snapshotDate ?? new Date());
  
  // Determine if eligible or warning
  const isEligible = text === 'Eligible now';
  
  return (
    <div className={`text-sm mt-1 flex items-center gap-1 ${
      isEligible 
        ? 'text-green-600 dark:text-green-400'
        : 'text-amber-600 dark:text-amber-400'
    }`}>
      {isEligible ? (
        <>
          <span>✅</span>
          <span>{text}</span>
        </>
      ) : (
        <>
          <span>⚠️</span>
          <span>
            {text}
            {buyDate && !isEligible && ' (CGT discount requires 12+ months)'}
          </span>
        </>
      )}
    </div>
  );
}
