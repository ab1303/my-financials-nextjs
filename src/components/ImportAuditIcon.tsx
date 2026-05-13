'use client';

import { BotIcon } from 'lucide-react';

interface ImportAuditIconProps {
  importImageId?: string | null;
  fileName?: string | null;
}

export default function ImportAuditIcon({
  importImageId,
  fileName,
}: ImportAuditIconProps) {
  if (!importImageId) return null;

  return (
    <span
      title={`Imported via AI${fileName ? ` from ${fileName}` : ''}`}
      className='inline-flex items-center text-blue-400 hover:text-blue-600'
    >
      <BotIcon className='h-4 w-4' />
    </span>
  );
}
