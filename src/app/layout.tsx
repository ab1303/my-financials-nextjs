import { Inter } from 'next/font/google';
import Providers from '@/components/Providers';

// types
import type { Metadata } from 'next';

// styles
import 'react-toastify/dist/ReactToastify.css';
import '@/styles/globals.css';
import 'react-day-picker/dist/style.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'My Financials',
  description: 'My Financials to track my finances',
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
