import React from 'react';

import THead from './components/THead';
import TBody from './components/TBody';
import TFoot from './components/TFoot';

type CommonComponents = {
  TBody: typeof TBody;
  THead: typeof THead;
  TFoot: typeof TFoot;
};

const Table: React.FC<{ children?: React.ReactNode }> & CommonComponents = ({
  children,
}) => (
  <table className='min-w-full divide-y divide-gray-200 overflow-x-scroll'>
    {children}
  </table>
);

Table.THead = THead;
Table.TBody = TBody;
Table.TFoot = TFoot;

export default Table;
