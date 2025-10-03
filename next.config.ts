import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config, { isServer }) => {
    // Exclude backend, indexer, and contracts directories from webpack compilation
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/node_modules', '**/backend/**', '**/indexer/**', '**/contracts/**'],
    };
    return config;
  },
  // Exclude backend directories from TypeScript checks
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
