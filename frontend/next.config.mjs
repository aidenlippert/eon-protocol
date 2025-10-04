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
              "connect-src 'self' https://verify.didit.me https://verification.didit.me https://*.didit.me https://*.arbitrum.io https://*.alchemy.com https://*.walletconnect.com https://*.walletconnect.org wss://*.walletconnect.com wss://*.walletconnect.org https://cca-lite.coinbase.com https://*.coinbase.com https://api.web3modal.org https://*.web3modal.org https://*.web3modal.com https://*.reown.com",
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
