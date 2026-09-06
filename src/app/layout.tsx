import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { ActivityTracker } from '@/components/ActivityTracker';
import { AuthProvider } from '@/lib/authContext';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
export const metadata: Metadata = {
  title: 'PrepTea',
  description: 'Master quantitative aptitude, logical reasoning, and much more with dynamic test papers.',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
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
          <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
            {children}
          </main>
          <footer className="border-t border-slate-800/80 bg-slate-950/60 py-6 mt-12">
            <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500">
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
