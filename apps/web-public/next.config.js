/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@teranga/ui'],
  images: {
    domains: ['localhost'],
  },
};

module.exports = nextConfig;
