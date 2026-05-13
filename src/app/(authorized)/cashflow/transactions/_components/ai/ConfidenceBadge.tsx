'use client';

import { getConfidenceColor } from './_schema';

export interface ConfidenceBadgeProps {
  score: number;
  className?: string;
}

export default function ConfidenceBadge({
  score,
  className = '',
}: ConfidenceBadgeProps) {
  const percentage = Math.round(score * 100);
  let level: 'HIGH' | 'MEDIUM' | 'LOW';

  if (percentage >= 85) {
    level = 'HIGH';
  } else if (percentage >= 60) {
    level = 'MEDIUM';
  } else {
    level = 'LOW';
  }

  const colorClass = getConfidenceColor(level);

  return (
    <div
      className={`inline-flex items-center px-3 py-1 rounded-full border ${colorClass} text-sm font-medium ${className}`}
    >
      <span className='mr-2'>
        {level === 'HIGH' && '✓'}
        {level === 'MEDIUM' && '○'}
        {level === 'LOW' && '!'}
      </span>
      <span>
        {percentage}% {level}
      </span>
    </div>
  );
}
