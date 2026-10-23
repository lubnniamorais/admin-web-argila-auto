// import type { NextConfig } from 'next';

const nextConfig = {
  reactStrictMode: true,
  compress: true,
  pageExtensions: ['page.tsx', 'api.ts', 'api.tsx'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '192.168.100.117',
      },
    ],
  },
};

module.exports = nextConfig;
