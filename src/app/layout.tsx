import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body suppressHydrationWarning className="antialiased bg-[#0b0f19] text-slate-100 flex flex-col min-h-screen">
        <AuthProvider>
          <ActivityTracker />
          <Navbar />
          <main className="flex-1 w-full flex flex-col min-h-0">
            {children}
          </main>
          <footer className="border-t border-slate-800/80 bg-slate-950/60 py-6 mt-12">
            <div className="w-full px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500">
              <p suppressHydrationWarning>© {new Date().getFullYear()} PrepTea.</p>
            </div>
          </footer>
        </AuthProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
