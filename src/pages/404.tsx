import * as React from 'react';
import { RiAlarmWarningFill } from 'react-icons/ri';

import CustomLink from '@/components/links/CustomLink';
import Seo from '@/components/Seo';

export default function NotFoundPage() {
  return (
    <div>
      <Seo templateTitle='Not Found' />

      <main>
        <section className='bg-dark'>
          <div className='flex flex-col items-center justify-center min-h-screen text-center text-white layout'>
            <RiAlarmWarningFill
              size={60}
              className='animate-flicker drop-shadow-glow'
            />
            <h1 className='mt-8 text-cyan-800'>Page Not Found</h1>
            <CustomLink className='mt-4 text-cyan-500' href='/'>
              Back to Home
            </CustomLink>
          </div>
        </section>
      </main>
    </div>
  );
}
