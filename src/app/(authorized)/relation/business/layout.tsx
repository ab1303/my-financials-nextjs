/* eslint-disable @next/next/no-before-interactive-script-outside-document */
import * as React from 'react';
import clsx from 'clsx';
import Script from 'next/script';
import { layoutStyles } from '@/styles/theme';

export default function BusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const apiKey = process.env.GOOGLE_API_KEY;

  return (
    <>
      <div
        className={clsx(
          'min-h-screen bg-gray-100 flex flex-col',
          layoutStyles.spacing.section,
          layoutStyles.spacing.sectionLg,
        )}
      >
        <div
          className={clsx(
            'container min-w-full mx-auto',
            layoutStyles.container['3xl'],
          )}
        >
          {children}
        </div>
      </div>
      <Script
        id='google-places'
        src={`https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initialiseGoogleMap`}
      />
    </>
  );
}
