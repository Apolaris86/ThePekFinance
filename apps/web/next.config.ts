import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pek/shared"],
  // Dev only: let phones on the home Wi-Fi open the dev site via the PC's LAN address.
  allowedDevOrigins: ["192.168.*.*"],
  cacheComponents: true,
  partialPrefetching: true,
  // Dev: lets the Expo web preview (localhost:8081) call this API. Native apps don't use CORS.
  // Production: lets MyEverythingApp (GitHub Pages) read the public market-data routes with plain GETs.
  // No Allow-Headers in production, so browsers there can't send a Bearer token cross-origin and the
  // signed-in routes (/api/ai/*, /api/live-token) stay same-origin only.
  async headers() {
    if (process.env.NODE_ENV === "production") {
      return [
        {
          source: "/api/:path*",
          headers: [
            { key: "Access-Control-Allow-Origin", value: "https://apolaris86.github.io" },
            { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          ],
        },
      ];
    }
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "http://localhost:8081" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type" },
        ],
      },
    ];
  },
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
