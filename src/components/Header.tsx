'use client';

import type { User } from 'next-auth';
import * as React from 'react';
import { useState } from 'react';

import SideNav from '../layouts/SideNav';

type HeaderProps = {
  user: User;
};

export default function Header({ user }: HeaderProps) {
  const [showSideNav, setShowSideNav] = useState(false);

  return (
    <div>
      <header className='sticky top-0 z-10 border-2 border-gray-200'>
        <div className='flex justify-between h-10'>
          <button className='p-2' onClick={() => setShowSideNav(true)}>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 512 512'
              className='w-6 h-6 text-gray-800'
            >
              <rect width='352' height='32' x='80' y='96'></rect>
              <rect width='352' height='32' x='80' y='240'></rect>
              <rect width='352' height='32' x='80' y='384'></rect>
            </svg>
          </button>
          <span className='flex-grow flex items-center justify-center font-extrabold font-serif text-xl text-cyan-700 '>
            {/* TODO: Pull this from context */}
            My Financials App
          </span>
          <div className='flex items-center relative'>
            <span className='text-gray-400'>
              Hi,
              <span className='font-semibold mx-2 text-cyan-600'>
                {user.name}
              </span>
            </span>
            {/* Cart TODO Later */}
            {/* <a
              className='text-gray-500 hover:text-gray-700 focus:text-gray-700 mr-4'
              href='#'
            >
              <svg
                aria-hidden='true'
                focusable='false'
                data-prefix='fas'
                data-icon='shopping-cart'
                className='w-4'
                role='img'
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 576 512'
              >
                <path
                  fill='currentColor'
                  d='M528.12 301.319l47.273-208C578.806 78.301 567.391 64 551.99 64H159.208l-9.166-44.81C147.758 8.021 137.93 0 126.529 0H24C10.745 0 0 10.745 0 24v16c0 13.255 10.745 24 24 24h69.883l70.248 343.435C147.325 417.1 136 435.222 136 456c0 30.928 25.072 56 56 56s56-25.072 56-56c0-15.674-6.447-29.835-16.824-40h209.647C430.447 426.165 424 440.326 424 456c0 30.928 25.072 56 56 56s56-25.072 56-56c0-22.172-12.888-41.332-31.579-50.405l5.517-24.276c3.413-15.018-8.002-29.319-23.403-29.319H218.117l-6.545-32h293.145c11.206 0 20.92-7.754 23.403-18.681z'
                ></path>
              </svg>
            </a> */}
          </div>
        </div>
      </header>

      <SideNav
        userRole={user.role}
        showSideNav={showSideNav}
        notifyCloseSideNav={() => setShowSideNav(false)}
      />
    </div>
  );
}
