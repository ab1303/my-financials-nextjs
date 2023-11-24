import Head from 'next/head';
import Card from '@/components/card';

export default function ZakatPage() {
  return (
    <>
      <Head>
        <title>Zakat</title>
        <meta name='page' content='zakat' />
        <link rel='icon' href='/favicon.ico' />
      </Head>

      <Card.Header>
        <div className='flex justify-between mt-4 text-left'>
          <Card.Header.Title>Zakat Page</Card.Header.Title>
        </div>
      </Card.Header>
      <div className='bg-white shadow mt-4 py-8 px-6 sm:px-10 rounded-lg'>
        Zakat
      </div>
    </>
  );
}
