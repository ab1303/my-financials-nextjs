import * as React from 'react';

export default async function CashFlowRootLayout({
  children,
}: {
  children: React.ReactElement;
}) {
  return (
    <div className='min-h-screen bg-gray-100 flex flex-col px-6 lg:px-8'>
      <div className='container min-w-full mx-auto'>{children}</div>
    </div>
  );
}
