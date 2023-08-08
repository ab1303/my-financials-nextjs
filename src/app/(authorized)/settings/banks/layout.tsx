/* eslint-disable @next/next/no-before-interactive-script-outside-document */
import Script from 'next/script';
import React from 'react';

export default async function BankLayout({
  children,
}: {
  children: React.ReactElement;
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
