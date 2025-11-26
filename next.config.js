/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY,
    GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL,
    GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  // Enable caching to reduce bandwidth
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 300, // Cache static data for 5 minutes
    },
  },
  // Compress responses
  compress: true,
}

module.exports = nextConfig