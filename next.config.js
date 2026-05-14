/** @type {import('next').NextConfig} */

const nextConfig = {
  // React strict mode for development warnings
  reactStrictMode: true,

  // Optimize images
  images: {
    unoptimized: true, // Since we're not serving images in this MVP
  },

  // Environment variables that should be available client-side
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ]
  },

  // Redirects (login required)
  async redirects() {
    return [
      // Redirect root to login if not authenticated
      // (handled client-side via _app.tsx)
    ]
  },
}

module.exports = nextConfig
