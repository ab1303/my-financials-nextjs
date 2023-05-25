import * as React from 'react';

function IconBank(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill='none' viewBox='0 0 15 15' height='1em' width='1em' {...props}>
      <path
        fill='currentColor'
        d='M7.5.5l.224-.447a.5.5 0 00-.448 0L7.5.5zM0 15h15v-1H0v1zM7.276.053l-6 3 .448.894 6-3-.448-.894zM0 6h15V5H0v1zm13.724-2.947l-6-3-.448.894 6 3 .448-.894zM5 8v4h1V8H5zm4 0v4h1V8H9zM1 5.5v9h1v-9H1zm12 0v9h1v-9h-1z'
      />
    </svg>
  );
}

export default IconBank;
