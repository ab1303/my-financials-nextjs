import { Disclosure } from '@headlessui/react';
import type { RoleEnumType } from '@prisma/client';
import clsx from 'clsx';
import { signOut } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';

import useOutsideAlerter from '@/hooks/useOutsideAlerter';

import SideNavLink from './SideNavLink';
import {
  IconBank,
  IconCashFlow,
  IconCross,
  IconGift,
  IconHome,
  IconProfile,
  IconBuilding,
  IconCashCoin,
  IconReceiptPercent,
  IconHandHoldingDollar,
  IconCalendar,
  IconRelations,
  IconUser,
} from './SideNavIcons';

type SideNavProps = {
  userRole: RoleEnumType | null;
  showSideNav: boolean;
  notifyCloseSideNav?: () => void;
};

export default function SideNav({
  userRole,
  showSideNav,
  notifyCloseSideNav,
}: SideNavProps) {
  const [openNav, setOpenNav] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  useOutsideAlerter(wrapperRef, handleCloseSideNav);

  useEffect(() => {
    setOpenNav(showSideNav);
  }, [showSideNav]);

  function handleCloseSideNav() {
    // Note event.preventDefault was causing other mouse events to be ignored
    // when nav was on page
    // event.preventDefault();
    setOpenNav(false);
    if (notifyCloseSideNav) notifyCloseSideNav();
  }

  async function handleSignOut() {
    await signOut({
      callbackUrl: '/',
    });
  }

  return (
    <nav
      ref={wrapperRef}
      className={clsx(
        'absolute inset-y-0 left-0 z-20 w-64 transform bg-white shadow-sm transition duration-200 ease-in-out',
        openNav ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      <div className='relative flex h-14 items-center justify-between'>
        <button
          className='p-2 focus-visible:outline-none'
          onClick={() => handleCloseSideNav()}
        >
          <IconCross />
        </button>
        <h2 className='m-3'></h2>
      </div>
      <ul className='flex flex-col text-sm'>
        <SideNavLink name='Home' href='/home' className='border-b-2'>
          <IconHome />
        </SideNavLink>

        <li>
          <Disclosure>
            <Disclosure.Button className='flex h-14 w-full items-center justify-start space-x-3 border-b-2 hover:border-cyan-300 hover:bg-gray-100'>
              <IconCashFlow />
              <span className={clsx('text-lg font-bold text-gray-600')}>
                CashFlow
              </span>
            </Disclosure.Button>
            <Disclosure.Panel as='ul' className='pl-3 text-gray-500'>
              <SideNavLink
                name='Income'
                href='/cashflow/income'
                className='border-b-0'
              >
                <IconCashCoin />
              </SideNavLink>
              <SideNavLink
                name='Donations'
                href='/cashflow/donations'
                className='border-b-0'
              >
                <IconGift />
              </SideNavLink>
              <SideNavLink
                name='Bank Interest'
                href='/cashflow/bank-interest'
                className='border-b-0'
              >
                <IconReceiptPercent />
              </SideNavLink>
            </Disclosure.Panel>
          </Disclosure>
        </li>
        <li>
          <Disclosure>
            <Disclosure.Button className='flex h-14 w-full items-center justify-start space-x-3 border-b-2 hover:border-cyan-300 hover:bg-gray-100'>
              <IconBuilding />
              <span className={clsx('text-lg font-bold text-gray-600')}>
                Asset(s)
              </span>
            </Disclosure.Button>
            <Disclosure.Panel as='ul' className='pl-3 text-gray-500'>
              <SideNavLink
                name='Bank(s)'
                href='/cashflow/bank'
                className='border-b-0'
              >
                <IconBank />
              </SideNavLink>
            </Disclosure.Panel>
          </Disclosure>
        </li>
        <li>
          <Disclosure>
            <Disclosure.Button className='flex h-14 w-full items-center justify-start space-x-3 border-b-2 hover:border-cyan-300 hover:bg-gray-100'>
              <IconRelations />
              <span className={clsx('text-lg font-bold text-gray-600')}>
                Relation(s)
              </span>
            </Disclosure.Button>
            <Disclosure.Panel as='ul' className='pl-3 text-gray-500'>
              <SideNavLink
                name='Business'
                href='/relation/business'
                className='border-b-0'
              >
                <IconBuilding />
              </SideNavLink>
              <SideNavLink
                name='Individual'
                href='/relation/individual'
                className='border-b-0'
              >
                <IconUser />
              </SideNavLink>
            </Disclosure.Panel>
          </Disclosure>
        </li>

        <SideNavLink name='Zakat' href='/zakat' className='border-b-2'>
          <IconHandHoldingDollar />
        </SideNavLink>

        {userRole === 'admin' && (
          <li>
            <Disclosure>
              <Disclosure.Button className='flex h-14 w-full items-center justify-start space-x-3 border-b-2 hover:border-cyan-300 hover:bg-gray-100'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 512 512'
                  className='mx-5 h-5 w-5'
                >
                  <path d='M245.151,168a88,88,0,1,0,88,88A88.1,88.1,0,0,0,245.151,168Zm0,144a56,56,0,1,1,56-56A56.063,56.063,0,0,1,245.151,312Z'></path>
                  <path d='M464.7,322.319l-31.77-26.153a193.081,193.081,0,0,0,0-80.332l31.77-26.153a19.941,19.941,0,0,0,4.606-25.439l-32.612-56.483a19.936,19.936,0,0,0-24.337-8.73l-38.561,14.447a192.038,192.038,0,0,0-69.54-40.192L297.49,32.713A19.936,19.936,0,0,0,277.762,16H212.54a19.937,19.937,0,0,0-19.728,16.712L186.05,73.284a192.03,192.03,0,0,0-69.54,40.192L77.945,99.027a19.937,19.937,0,0,0-24.334,8.731L21,164.245a19.94,19.94,0,0,0,4.61,25.438l31.767,26.151a193.081,193.081,0,0,0,0,80.332l-31.77,26.153A19.942,19.942,0,0,0,21,347.758l32.612,56.483a19.937,19.937,0,0,0,24.337,8.73l38.562-14.447a192.03,192.03,0,0,0,69.54,40.192l6.762,40.571A19.937,19.937,0,0,0,212.54,496h65.222a19.936,19.936,0,0,0,19.728-16.712l6.763-40.572a192.038,192.038,0,0,0,69.54-40.192l38.564,14.449a19.938,19.938,0,0,0,24.334-8.731L469.3,347.755A19.939,19.939,0,0,0,464.7,322.319Zm-50.636,57.12-48.109-18.024-7.285,7.334a159.955,159.955,0,0,1-72.625,41.973l-10,2.636L267.6,464h-44.89l-8.442-50.642-10-2.636a159.955,159.955,0,0,1-72.625-41.973l-7.285-7.334L76.241,379.439,53.8,340.562l39.629-32.624-2.7-9.973a160.9,160.9,0,0,1,0-83.93l2.7-9.972L53.8,171.439l22.446-38.878,48.109,18.024,7.285-7.334a159.955,159.955,0,0,1,72.625-41.973l10-2.636L222.706,48H267.6l8.442,50.642,10,2.636a159.955,159.955,0,0,1,72.625,41.973l7.285,7.334,48.109-18.024,22.447,38.877-39.629,32.625,2.7,9.972a160.9,160.9,0,0,1,0,83.93l-2.7,9.973,39.629,32.623Z'></path>
                </svg>
                <span className={clsx('text-lg font-bold text-gray-600')}>
                  Settings
                </span>
              </Disclosure.Button>
              <Disclosure.Panel as='ul' className='pl-3 text-gray-500'>
                <SideNavLink
                  name='Profile'
                  href='/settings/profile'
                  className='border-b-2'
                >
                  <IconProfile />
                </SideNavLink>
                <SideNavLink
                  name='Bank(s)'
                  href='/settings/banks'
                  className='border-b-0'
                >
                  <IconBank />
                </SideNavLink>
                <SideNavLink
                  name='Calendar Year(s)'
                  href='/settings/calendar'
                  className='border-b-0'
                >
                  <IconCalendar />
                </SideNavLink>
              </Disclosure.Panel>
            </Disclosure>
          </li>
        )}

        <button
          type='button'
          className='flex h-14 w-full items-center justify-start space-x-3 border-b-2 hover:border-cyan-300 hover:bg-gray-100'
          onClick={handleSignOut}
        >
          <svg
            xmlns='http://www.w3.org/2000/svg'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
            className='mx-5 h-5 w-5 text-gray-600'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1'
            />
          </svg>
          <span className='text-lg font-bold text-gray-600'>Logout</span>
        </button>
      </ul>
    </nav>
  );
}
