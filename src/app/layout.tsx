import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { ActivityTracker } from '@/components/ActivityTracker';
import { AuthProvider } from '@/lib/authContext';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://preptea.vercel.app';

export const viewport: Viewport = {
  themeColor: '#0b0f19',
  colorScheme: 'dark',
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'PrepTea',
    template: '%s | PrepTea',
  },
  description: 'Master quantitative aptitude, logical reasoning, data interpretation, and practice tests with real-time telemetry and solution explanations.',
  keywords: ['PrepTea', 'Aptitude', 'Logical Reasoning', 'Quantitative Aptitude', 'DSA', 'Practice Tests', 'Placement Preparation'],
  authors: [{ name: 'PrepTea Team' }],
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.png', type: 'image/png' },
    ],
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  manifest: '/manifest.json',
  openGraph: {
    title: 'PrepTea',
    description: 'Master quantitative aptitude, logical reasoning, and practice tests with interactive analytics and solution explanations.',
    url: siteUrl,
    siteName: 'PrepTea',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'PrepTea',
        type: 'image/png',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PrepTea',
    description: 'Master quantitative aptitude, logical reasoning, and practice tests with interactive analytics.',
    images: ['/og-image.png'],
    creator: '@preptea',
  },
};

import { ThemeProvider } from '@/components/ThemeProvider';
import { TopLoader } from '@/components/TopLoader';
import { DownloadProvider } from '@/lib/downloadContext';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import { GlobalOfflineWrapper } from '@/components/GlobalOfflineWrapper';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body suppressHydrationWarning className="antialiased bg-[#0b0f19] bg-background text-foreground flex flex-col min-h-screen">
        <TopLoader />
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <AuthProvider>
            <DownloadProvider>
              <ActivityTracker />
              <Navbar />
              <main className="flex-1 w-full flex flex-col min-h-0 pt-14 sm:pt-16 pb-16 md:pb-0">
                <GlobalOfflineWrapper>
                  {children}
                </GlobalOfflineWrapper>
              </main>
              <MobileBottomNav />
              <OfflineBanner />
              <ServiceWorkerRegistration />
            </DownloadProvider>
          </AuthProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
