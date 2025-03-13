/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  
  // Configure source maps based on environment
  productionBrowserSourceMaps: process.env.NODE_ENV === 'development',
  
  // Enable webpack optimization for production
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      // Enable production optimizations
      config.optimization = {
        ...config.optimization,
        minimize: true,
        splitChunks: {
          chunks: 'all',
          minSize: 20000,
          maxSize: 100000,
        },
        runtimeChunk: {
          name: 'runtime',
        },
      };
    }
    return config;
  },
};

export default nextConfig;
