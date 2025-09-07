import React from 'react';

export default function BusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className='max-w-3xl mx-auto py-8 px-4'>
      <h1 className='text-2xl font-bold mb-6'>Business Management</h1>
      {children}
    </section>
  );
}
