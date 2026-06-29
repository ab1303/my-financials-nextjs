import Script from 'next/script';
import * as React from 'react';

export default function IndividualLayout({
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
