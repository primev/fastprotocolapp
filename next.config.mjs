import { fileURLToPath } from 'node:url';
import createJiti from 'jiti';
const jiti = createJiti(fileURLToPath(import.meta.url));

// Import env here to validate during build
jiti('./src/env/server');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep SSR/basic settings default for now to match primev.xyz phase-1
  // distDir: './.next',
  // reactStrictMode: true,
  // basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  // webpack(config) {
  //   // Optional: Preserve Vite-style alias if desired
  //   // config.resolve.alias['@'] = require('path').resolve(__dirname, 'src');
  //   return config;
  // },
  env: {
    NEXT_PUBLIC_BASE_URL: (() => {
      // If explicitly set in .env, use that (for local development)
      if (process.env.NEXT_PUBLIC_BASE_URL) {
        return process.env.NEXT_PUBLIC_BASE_URL;
      }
      
      // In Vercel (any environment), use VERCEL_URL
      // VERCEL_URL is always available
      if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
      }
      
      // Fallback to localhost for local development
      return 'http://localhost:3000';
    })(),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.coingecko.com',
        pathname: '/coins/images/**',
      },
      {
        protocol: 'https',
        hostname: 'coin-images.coingecko.com',
        pathname: '/coins/images/**',
      },
      {
        protocol: 'https',
        hostname: 'cryptologos.cc',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'token-icons.s3.amazonaws.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'icons.llamao.fi',
        pathname: '/icons/tokens/**',
      },
      {
        protocol: 'https',
        hostname: 'tokens.1inch.io',
        pathname: '/**',
      },
    ],
  },
};
export default nextConfig;
