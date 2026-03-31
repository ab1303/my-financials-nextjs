import { Inter } from 'next/font/google';
import Providers from '@/components/Providers';
import { ThemeProvider } from '@/components/theme-provider';

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
    <html lang='en' className={inter.className} suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute='class'
          defaultTheme='light'
          enableSystem
          disableTransitionOnChange
        >
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
