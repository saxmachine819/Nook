const { withSentryConfig } = require("@sentry/nextjs");

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
  // Temporarily disable webpack cache to fix corruption issues
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      config.cache = false
    }
    return config
  },
}

// Sentry: org/project used for source map upload (optional; set in Vercel/CI)
const sentryOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
};

module.exports = withSentryConfig(nextConfig, sentryOptions);