/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@psyhocourse/shared'],
  poweredByHeader: false,
  reactStrictMode: true,
  // ESLint runs in CI — do not block production builds
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    // pdf.js optionally depends on canvas for server-side rendering; disable it
    // in the browser bundle to avoid "Module not found: Can't resolve 'canvas'" errors.
    config.resolve.alias['canvas'] = false;
    return config;
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    },
  ],
};

export default nextConfig;
