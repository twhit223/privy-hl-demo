import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exclude test files from server components
  serverExternalPackages: ['tap', 'tape', 'why-is-node-running'],
  webpack: (config, { isServer }) => {
    // Make Solana packages optional (we're not using Solana)
    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@solana-program/system': false,
    };

    // Ignore test files in node_modules
    if (isServer) {
      config.externals = config.externals || [];
      if (typeof config.externals === 'function') {
        const originalExternals = config.externals;
        config.externals = [
          ...(Array.isArray(originalExternals) ? originalExternals : []),
          ({ request }: { request?: string }, callback: any) => {
            if (
              request?.includes('/test/') ||
              request === 'tap' ||
              request === 'tape' ||
              request === 'why-is-node-running'
            ) {
              return callback(null, `commonjs ${request}`);
            }
            if (typeof originalExternals === 'function') {
              return originalExternals({ request }, callback);
            }
            callback();
          },
        ];
      }
    }
    return config;
  },
};

export default nextConfig;
