/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  // Allow Mapbox CSS to be imported
  transpilePackages: [],
  // PWA-ready configuration (can be enhanced with next-pwa later)
}

module.exports = nextConfig