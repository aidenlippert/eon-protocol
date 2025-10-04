/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['../**', '**/node_modules'],
    };
    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://verify.didit.me https://verification.didit.me https://*.didit.me",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https: https://*.didit.me",
              "font-src 'self' data:",
              "connect-src 'self' https://verify.didit.me https://verification.didit.me https://*.didit.me https://*.arbitrum.io https://*.alchemy.com https://*.walletconnect.com wss://*.walletconnect.com https://pulse.walletconnect.org https://api.web3modal.org https://rpc.walletconnect.com https://relay.walletconnect.com https://cca-lite.coinbase.com https://*.coinbase.com",
              "frame-src 'self' https://verify.didit.me https://verification.didit.me https://*.didit.me",
              "media-src 'self' blob: https://*.didit.me",
              "worker-src 'self' blob:",
            ].join('; '),
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
