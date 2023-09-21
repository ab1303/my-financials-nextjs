import clsx from 'clsx';
import type { MouseEventHandler } from 'react';

interface AddIconProps extends React.ComponentPropsWithoutRef<'svg'> {
  onClick?: MouseEventHandler<SVGSVGElement> | undefined;
}

export default function AddIcon({ onClick, ...rest }: AddIconProps) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      className={clsx('h-4 w-4', rest.className)}
      fill='none'
      viewBox='0 0 24 24'
      stroke='currentColor'
      onClick={onClick}
      {...rest}
    >
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth={2}
        d='M12 4v16m8-8H4'
      />
    </svg>
  );
}
