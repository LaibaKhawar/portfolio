import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // The case-study pages and the lab were folded into one Projects page.
  async redirects() {
    return [
      { source: "/lab", destination: "/projects", permanent: true },
      { source: "/work", destination: "/projects", permanent: true },
      { source: "/work/:slug", destination: "/projects#:slug", permanent: true },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
