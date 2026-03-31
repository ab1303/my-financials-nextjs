import React from 'react';

const TBodyTR: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <tr className='odd:bg-muted/30 hover:bg-muted/50 transition-colors'>
    {children}
  </tr>
);

export default TBodyTR;
