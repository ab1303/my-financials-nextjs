import React from 'react';

// const Wrapper = styled('tr')`
//   outline: 0;
//   verticalalign: 'middle';
//   fontweight: 500;
//   lineheight: '1.5rem';
//   position: 'relative';
//   borderbottom: '1px solid rgba(224, 224, 224, 1)';
// `;

const THeadTR: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <tr className='relative border-b-2 outline-none align-middle'>{children}</tr>
);

export default THeadTR;
