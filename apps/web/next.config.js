const path = require('path');
const dotenv = require('dotenv');

// Automatically load environment variables from root and apps/web
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
    instrumentationHook: true,
  },
};

module.exports = nextConfig;
