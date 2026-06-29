import React from 'react';

const THeadTR: React.FC<{
  // headerGroupProps?: TableHeaderGroupProps;
  children?: React.ReactNode;
}> = ({ children }) => (
  <tr className='relative border-b-2 outline-none align-middle'>{children}</tr>
);

export default THeadTR;
