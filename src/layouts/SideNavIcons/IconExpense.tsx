import * as React from 'react';

function IconExpense(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      fill='none'
      viewBox='0 0 24 24'
      strokeWidth={1.5}
      stroke='currentColor'
      className='mx-5 h-5 w-5'
      {...props}
    >
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        d='M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 3.07-.879 4.242 0M9.75 17h.008v.008H9.75V17zm4.5 0h.008v.008h-.008V17zm4.5 0h.008v.008h-.008V17z'
      />
    </svg>
  );
}

export default IconExpense;
