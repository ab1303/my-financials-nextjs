import React from 'react';

// const Wrapper = styled('td')`
//   ${cell};
//   font-size: ${({ theme }: any) => theme.fontSizes.sm};
//   padding-top: ${({ theme }: any) => theme.space[2]}};
//   padding-bottom: ${({ theme }: any) => theme.space[2]}};
//   border-top-width: 1px;
// `;

type TBodyTDProps = {
  children?: React.ReactNode;
} & React.ComponentPropsWithoutRef<'div'>;

const TBodyTD = ({ children, ...rest }: TBodyTDProps) => {
  return (
    <td role='cell' className='px-6 py-4' {...rest}>
      <span className='text-sm text-gray-500'>{children}</span>
    </td>
  );
};

export default TBodyTD;
