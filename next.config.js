/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  // Allow Mapbox CSS to be imported
  transpilePackages: [],
  // PWA-ready configuration (can be enhanced with next-pwa later)
}

module.exports = nextConfig