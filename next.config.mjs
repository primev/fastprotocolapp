import { fileURLToPath } from 'node:url';
import createJiti from 'jiti';
const jiti = createJiti(fileURLToPath(import.meta.url));

// Import env here to validate during build
jiti('./src/env/server');

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Handle packages that have issues with webpack bundling
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        // MetaMask SDK uses React Native async storage, provide empty fallback for web
        '@react-native-async-storage/async-storage': false,
        // pino-pretty is optional and only needed in Node.js
        'pino-pretty': false,
      };
    }

    // Ignore optional dependencies that cause build warnings
    config.externals = config.externals || [];
    if (!isServer) {
      config.externals.push({
        'pino-pretty': 'pino-pretty',
      });
    }

    return config;
  },
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
        hostname: 'cryptologos.cc',
        pathname: '/**',
      },
    ],
  },
};
export default nextConfig;
