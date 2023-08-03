import React from 'react';

import TBody from './components/TBody';
import THead from './components/THead';

type CommonComponents = {
  TBody: typeof TBody;
  THead: typeof THead;
};

const Table: React.FC<{ children?: React.ReactNode }> & CommonComponents = ({
  children,
}) => (
  <table className='min-w-full divide-y divide-gray-200 overflow-x-scroll'>
    {children}
  </table>
);

Table.TBody = TBody;
Table.THead = THead;

export default Table;
