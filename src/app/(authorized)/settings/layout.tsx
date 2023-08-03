import * as React from 'react';

export default async function SettingsRootLayout({
  children,
}: {
  children: React.ReactElement;
}) {
  return (
    <div className='min-h-screen bg-gray-100 flex flex-col px-6 lg:px-8'>
      <div className='container min-w-full mx-auto'>
        <div className='mx-auto w-3/4'>{children}</div>
      </div>
    </div>
  );
}
