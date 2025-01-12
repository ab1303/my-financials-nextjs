'use client';

import Link from 'next/link';
import React from 'react';

type HeroProps = {
  appType: string;
  tagLine: string;
  description: string;
  mainActionText: string;
  extraActionText: string;
  showActionButtons: boolean;
};

const Hero = ({
  appType,
  tagLine,
  description,
  mainActionText,
  extraActionText,
  showActionButtons,
}: HeroProps) => {
  return (
    <div id='product'>
      <div
        style={{ textShadow: '0px 1px 1px gray' }}
        className='flex flex-col items-center justify-start font-sans min-h-96 bg-gray-800 lg:pt-10 lg:pb-20 lg:bg-hero lg:bg-cover'
      >
        <div>
          <p className='p-3 pt-12 text-lg font-bold text-cyan-500'>{appType}</p>
        </div>
        <div>
          <p className='p-2 text-4xl font-bold text-center text-blue-800 lg:mx-auto lg:w-4/6 lg:text-5xl lg:text-gray-300'>
            {tagLine}
          </p>
        </div>
        <div>
          <p className='p-4 pt-6 font-sans text-2xl leading-10 text-center text-gray-500 lg:text-gray-200'>
            {description}
          </p>
        </div>
        {showActionButtons && (
          <div className='relative z-50 flex flex-col items-center justify-between h-48 lg:space-x-8 pt-7 lg:pt-0 lg:flex-row lg:justify-between lg:w-90'>
            <Link href='/auth/login' passHref>
              <button className='pt-3 pb-3 pl-12 pr-12 text-2xl font-semibold text-center text-white transition-all bg-cyan-600 rounded-full shadow-2xl lg:ml-5 hover:bg-cyan-700 focus:outline-none ring-4 ring-cyan-600 lg:ring-2 lg:font-medium '>
                {mainActionText}
              </button>
            </Link>
            <Link href='/auth/register' passHref>
              <button className='pt-3 pb-3 text-2xl font-semibold text-center text-cyan-500 transition-all rounded-full shadow-2xl lg:mr-5 hover:text-cyan-500 hover:bg-gray-50 pl-11 pr-11 bg-gray-50 focus:outline-none ring-4 ring-cyan-500 lg:font-medium lg:text-gray-50 lg:bg-opacity-0 lg:ring-2 lg:ring-white'>
                {extraActionText}
              </button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Hero;
