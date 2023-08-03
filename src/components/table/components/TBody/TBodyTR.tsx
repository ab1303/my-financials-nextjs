import React from 'react';

const TBodyTR: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <tr className='odd:bg-gray-50 odd:opacity-95'>{children}</tr>
);

export default TBodyTR;
