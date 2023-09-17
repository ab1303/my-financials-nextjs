import * as React from 'react';

export default async function CashFlowRootLayout({
  children,
}: {
  children: React.ReactElement;
}) {
  return (
    <div className='min-h-screen bg-gray-100 flex flex-col px-6 lg:px-8'>
      <div className='container min-w-full mx-auto'>
        <div className='mx-auto md:w-3/5 xl:w-2/5'>{children}</div>
      </div>
    </div>
  );
}
