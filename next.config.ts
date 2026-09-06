import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.pstatic.net" },
    ],
  },
  experimental: {
    // vinext classifies multipart App Route requests as possible Server Actions
    // before dispatch. Keep this above the 30MB client/server upload budget.
    serverActions: { bodySizeLimit: "32mb" },
  },
};

export default nextConfig;
