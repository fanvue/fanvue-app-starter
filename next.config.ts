import type { NextConfig } from "next";

const FANVUE_ORIGIN = process.env.FANVUE_PLATFORM_URL ?? "https://www.fanvue.com";

/**
 * Embedded apps must allow Fanvue to frame them — without this header the
 * browser refuses to render the app inside the Fanvue iframe.
 */
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${FANVUE_ORIGIN}`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
