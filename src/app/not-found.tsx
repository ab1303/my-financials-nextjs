import Link from 'next/link';
import type { Metadata } from 'next';
import { RiAlarmWarningFill } from 'react-icons/ri';

export const metadata: Metadata = {
  title: 'Not Found',
  description: 'Page not found',
};

export default function NotFound() {
  return (
    <main>
      <section className='bg-dark'>
        <div className='flex min-h-screen flex-col items-center justify-center text-center text-white'>
          <RiAlarmWarningFill size={60} className='text-cyan-500' />
          <h1 className='mt-8 text-cyan-800'>Page Not Found</h1>
          <Link
            className='mt-4 font-bold text-cyan-500 hover:underline'
            href='/'
          >
            Back to Home
          </Link>
        </div>
      </section>
    </main>
  );
}
