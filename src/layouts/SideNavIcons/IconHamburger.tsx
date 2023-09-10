import * as React from 'react';

function IconHamburger(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 512 512'
      className='w-6 h-6 text-gray-800'
      {...props}
    >
      <rect width='352' height='32' x='80' y='96'></rect>
      <rect width='352' height='32' x='80' y='240'></rect>
      <rect width='352' height='32' x='80' y='384'></rect>
    </svg>
  );
}

export default IconHamburger;
