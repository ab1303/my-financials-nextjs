import React from 'react';

// const Wrapper = styled('td')`
//   ${cell};
//   font-size: ${({ theme }: any) => theme.fontSizes.sm};
//   padding-top: ${({ theme }: any) => theme.space[2]}};
//   padding-bottom: ${({ theme }: any) => theme.space[2]}};
//   border-top-width: 1px;
// `;

const TBodyTD: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  return (
    <td role='cell' className='px-6 py-4'>
      <span className='text-sm text-gray-500'>{children}</span>
    </td>
  );
};

export default TBodyTD;
