import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Children, cloneElement } from 'react';

type NamedChildrenSlots = {
  media: React.ReactElement;
  action: React.ReactNode;
};

type SideNavLinkProps = {
  href: string;
  name: string;
  className?: string;
  children: React.ReactElement | NamedChildrenSlots;
};

const isObject = <T extends Record<string, unknown>>(
  value: unknown
): value is T =>
  typeof value === 'object' &&
  typeof value !== 'function' &&
  typeof value !== undefined;

const isNamedSlots = (children: unknown): children is NamedChildrenSlots =>
  isObject(children) && 'action' in children;

export default function SideNavLink({
  href,
  name,
  className,
  children,
}: SideNavLinkProps) {
  const pathname = usePathname();

  const childrenWithProps = isNamedSlots(children)
    ? cloneElement(children.media, {
        className: clsx(
          children.media.props.className,
          'w-5 h-5 mx-5',
          pathname === href ? 'text-cyan-600' : 'text-gray-600'
        ),
      })
    : Children.map(children, (child: React.ReactElement) => {
        return cloneElement(child, {
          className: clsx(
            child.props.className,
            'w-5 h-5 mx-5',
            pathname === href ? 'text-cyan-600' : 'text-gray-600'
          ),
        });
      });

  return (
    <li
      className={clsx(
        'flex h-14 items-center justify-between rounded-sm hover:border-cyan-300 hover:bg-gray-100',
        className
      )}
    >
      <Link href={href}>
        <span className='flex h-full w-full items-center justify-start space-x-3'>
          {childrenWithProps}
          <span
            className={clsx(
              'text-lg font-bold',
              pathname === href ? 'text-cyan-600' : 'text-gray-600'
            )}
          >
            {name}
          </span>
        </span>
      </Link>
    </li>
  );
}
