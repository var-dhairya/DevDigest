/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable static exports for Vercel
  output: 'standalone',
  
  // Image optimization settings
  images: {
    domains: [
      'reddit.com', 
      'i.redd.it', 
      'external-preview.redd.it', 
      'preview.redd.it',
      'hacker-news.firebaseio.com',
      'dev.to',
      'indiehackers.com'
    ],
    unoptimized: false,
  },
  
  // Environment variables
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  
  // Experimental features for better performance
  experimental: {
    optimizePackageImports: ['@google/generative-ai'],
  },
  
  // Webpack configuration for better bundle optimization
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
}

export default nextConfig 