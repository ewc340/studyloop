import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Playwright runs its own dev server in a separate build folder, so it can run alongside `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Keep agent screenshots clean.
  devIndicators: process.env.E2E_AUTH_BYPASS === "1" ? false : undefined,
  experimental: {
    serverActions: {
      // Issue reports carry images: up to 6 of 5 MB each (ISSUE_REPORT_LIMITS), plus form overhead.
      bodySizeLimit: "32mb",
    },
  },
};

export default nextConfig;
