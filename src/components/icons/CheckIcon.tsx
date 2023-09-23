import clsx from 'clsx';
import type { MouseEventHandler } from 'react';

{
  /* https://stackoverflow.com/questions/65230250/onclick-event-handler-not-work-as-expected-when-attached-to-svg-icon-in-react */
}
interface CheckIconProps
  extends Omit<React.ComponentPropsWithoutRef<'svg'>, 'onClick'> {
  onClick?: MouseEventHandler<HTMLDivElement> | undefined;
}

export default function CheckIcon({
  onClick,
  className,
  ...rest
}: CheckIconProps) {
  return (
    <div onClick={onClick}>
      <svg
        xmlns='http://www.w3.org/2000/svg'
        fill='none'
        viewBox='0 0 24 24'
        strokeWidth={1.5}
        stroke='currentColor'
        className={clsx('w-4 h-4 cursor-pointer', className)}
        {...rest}
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          d='M4.5 12.75l6 6 9-13.5'
        />
      </svg>
    </div>
  );
}
