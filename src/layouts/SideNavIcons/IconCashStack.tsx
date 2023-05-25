import * as React from 'react';

function IconCashStack(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill='currentColor'
      viewBox='0 0 16 16'
      height='1em'
      width='1em'
      {...props}
    >
      <path d='M1 3a1 1 0 011-1h12a1 1 0 011 1H1zm7 8a2 2 0 100-4 2 2 0 000 4z' />
      <path d='M0 5a1 1 0 011-1h14a1 1 0 011 1v8a1 1 0 01-1 1H1a1 1 0 01-1-1V5zm3 0a2 2 0 01-2 2v4a2 2 0 012 2h10a2 2 0 012-2V7a2 2 0 01-2-2H3z' />
    </svg>
  );
}

export default IconCashStack;
