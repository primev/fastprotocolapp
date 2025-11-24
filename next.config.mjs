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
};
export default nextConfig;
