import React from 'react';

const TFootTH: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  return (
    <th
      scope='col'
      className='group px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider'
    >
      <span>{children}</span>
    </th>
  );
};

export default TFootTH;
