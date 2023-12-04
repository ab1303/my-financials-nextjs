// In your application's entrypoint

import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';

import Hero from '@/components/Hero';
import { authOptions } from '@/utils/authOptions';

export default async function LandingPage() {
  const data = {
    hero: {
      appType: 'My Financials',
      tagLine: 'Keep your financials in check',
      description:
        'An app to track your financial position and spendings. Moreover to help you calculate your annual zakat liabilities',
      mainActionText: 'Sign in',
      extraActionText: 'Sign up',
      showActionButtons: true,
    },
  };

  const session = await getServerSession(authOptions);

  if (session?.user) {
    redirect('/home');
  }

  return (
    <main className='bg-gray-50'>
      <Hero
        appType={data.hero.appType}
        tagLine={data.hero.tagLine}
        description={data.hero.description}
        mainActionText={data.hero.mainActionText}
        extraActionText={data.hero.extraActionText}
        showActionButtons={data.hero.showActionButtons}
      />
    </main>
  );
}
