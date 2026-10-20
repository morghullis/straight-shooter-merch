import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
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
