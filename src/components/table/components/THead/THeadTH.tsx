import React from 'react';
import clsx from 'clsx';

const THeadTH: React.FC<{ children?: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => {
  return (
    <th
      scope='col'
      className={clsx(
        'group px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none cursor-default',
        className,
      )}
    >
      <span>{children}</span>
    </th>
  );
};

export default THeadTH;
