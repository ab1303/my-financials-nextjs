import type { Metadata } from 'next';
import 'react-toastify/dist/ReactToastify.css';
import { Inter } from 'next/font/google'


import Providers from '@/components/Providers';
import '@/styles/globals.css';


const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'My Financials',
  description: 'My Financials App to track my finances',
  icons: {
    icon: '/favicon.ico',
  },
};


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='en' className={inter.className}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
