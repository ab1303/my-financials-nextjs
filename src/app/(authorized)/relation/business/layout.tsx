/* eslint-disable @next/next/no-before-interactive-script-outside-document */
import * as React from 'react';
import Script from 'next/script';

export default function BusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const apiKey = process.env.GOOGLE_API_KEY;

  return (
    <>
      {children}
      <Script
        id='google-places'
        src={`https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initialiseGoogleMap`}
      />
    </>
  );
}
