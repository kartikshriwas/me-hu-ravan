import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/**': ['./Courses/**/*'],
  },

  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

  compress: true,
  poweredByHeader: false,

  // L-5: Only expose internal dev origins in development
  ...(process.env.NODE_ENV === 'development' ? { allowedDevOrigins: ['10.16.65.83', "10.139.66.83", 'localhost:3000', 'localhost:3001'] } : {}),

  // Headers for Edge caching & security
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
      {
        source: '/(favicon.svg|favicon.png|icon.png|icon.svg|manifest.json|og-image.png)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default nextConfig;
