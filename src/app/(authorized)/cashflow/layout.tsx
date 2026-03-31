import * as React from 'react';

export default async function CashFlowRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className='min-h-screen bg-background'>
      <div className='container mx-auto px-4 py-6 max-w-5xl'>{children}</div>
    </div>
  );
}
