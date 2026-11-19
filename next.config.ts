import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheLife: {
    // Everything read from Shopify (products, collections, their fields and order). A product saved
    // in the admin refreshes at once through the webhook (/api/revalidate); this is the safety net for
    // changes Shopify sends no webhook for (a field set by an app, a collection's manual order): the
    // next visit after 5 minutes refreshes it in the background.
    catalog: {
      stale: 30,
      revalidate: 300,
      expire: 86400,
    },
  },
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
