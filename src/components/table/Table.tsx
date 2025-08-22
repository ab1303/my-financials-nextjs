import React from 'react';
import clsx from 'clsx';

import THead from './components/THead';
import TBody from './components/TBody';
import TFoot from './components/TFoot';

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
      'overflow-x-auto shadow-sm border border-gray-200 rounded-lg',
      className,
    )}
  >
    <table
      className={clsx('min-w-full divide-y divide-gray-200', tableClassName)}
    >
      {children}
    </table>
  </div>
);

Table.THead = THead;
Table.TBody = TBody;
Table.TFoot = TFoot;

export default Table;
