import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Pages visited or prefetched in the browser are reused for 30 s (the minimum) instead of 5 min,
    // so a change made in Shopify also shows to a shopper who is already browsing.
    staleTimes: { static: 30 },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // Product media served by the Shopify CDN once a store is connected.
      { protocol: "https", hostname: "cdn.shopify.com" },
    ],
  },
  turbopack: {
    // Pin the workspace root so a stray lockfile in a parent folder is ignored.
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
