import clsx from 'clsx';
import React from 'react';

import TBody from './components/TBody';
import TFoot from './components/TFoot';
import THead from './components/THead';

type CommonComponents = {
  TBody: typeof TBody;
  THead: typeof THead;
  TFoot: typeof TFoot;
};

type TableProps = {
  children?: React.ReactNode;
  className?: string;
  tableClassName?: string;
};

const Table: React.FC<TableProps> & CommonComponents = ({
  children,
  className,
  tableClassName,
}) => (
  <div
    className={clsx(
      'overflow-x-auto shadow-sm border border-border rounded-lg',
      className,
    )}
  >
    <table
      className={clsx('min-w-full divide-y divide-border', tableClassName)}
    >
      {children}
    </table>
  </div>
);

Table.THead = THead;
Table.TBody = TBody;
Table.TFoot = TFoot;

export default Table;
