import * as React from 'react';

function IconReceiptPercent(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      fill='none'
      viewBox='0 0 24 24'
      strokeWidth={1.5}
      stroke='currentColor'
      height='1em'
      width='1em'
      {...props}
    >
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        d='M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185zM9.75 9h.008v.008H9.75V9zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 4.5h.008v.008h-.008V13.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z'
      />
    </svg>

    // <svg
    //   fill='currentColor'
    //   viewBox='0 0 16 16'
    //   height='1em'
    //   width='1em'
    //   {...props}
    // >
    //   <path d='M1 3a1 1 0 011-1h12a1 1 0 011 1H1zm7 8a2 2 0 100-4 2 2 0 000 4z' />
    //   <path d='M0 5a1 1 0 011-1h14a1 1 0 011 1v8a1 1 0 01-1 1H1a1 1 0 01-1-1V5zm3 0a2 2 0 01-2 2v4a2 2 0 012 2h10a2 2 0 012-2V7a2 2 0 01-2-2H3z' />
    // </svg>
  );
}

export default IconReceiptPercent;
