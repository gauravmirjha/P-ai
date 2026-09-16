import { Fraunces, Inter } from 'next/font/google';
import './globals.css';
import BottomNav from '@/components/BottomNav';
import PageTransition from '@/components/PageTransition';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-fraunces',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-inter',
});

export const metadata = {
  title: 'Personal OS',
  description: 'Your ledger, your board, your content — one command center.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Personal OS',
  },
  // `appleWebApp.capable` emits only the apple-prefixed tag, which Chrome now
  // warns is deprecated. The standard one has to be added by hand.
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport = {
  themeColor: '#0B0F12',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-180.png" />
      </head>
      <body
        className="font-sans min-h-screen antialiased"
        style={{ paddingBottom: 'calc(7.5rem + var(--safe-bottom))' }}
      >
        <ServiceWorkerRegister />
        {/* The bottom inset was already handled on <body>, but the top was not:
            40px of padding sits under a 59px status bar on a notched phone, so
            every page title was partly behind the clock. Set here rather than
            as a pt-* class so two padding declarations cannot compete. */}
        <main
          className="max-w-xl mx-auto px-4"
          style={{ paddingTop: 'calc(2.5rem + var(--safe-top))' }}
        >
          <PageTransition>{children}</PageTransition>
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
