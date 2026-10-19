import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pek/shared"],
  // Dev only: let phones on the home Wi-Fi open the dev site via the PC's LAN address.
  allowedDevOrigins: ["192.168.*.*"],
  cacheComponents: true,
  partialPrefetching: true,
  // Dev only: lets the Expo web preview (localhost:8081) call this API. Native
  // apps don't use CORS, so production needs no cross-origin access.
  async headers() {
    if (process.env.NODE_ENV === "production") return [];
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
