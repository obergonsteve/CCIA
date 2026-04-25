import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  /**
   * Prepend a NetworkOnly rule so SW never serves a stale/wrong ico (tab flash).
   * Requires extending defaults — a bare `runtimeCaching` array *replaces* them.
   */
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: ({ url }: { url: URL }) => url.pathname === "/favicon.ico",
        handler: "NetworkOnly",
        method: "GET",
      },
    ],
  },
});

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
  /**
   * Hint the browser to fetch the favicon in parallel with the HTML; Next still
   * places `<link rel="icon">` after scripts, which can show a default briefly.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Link",
            value: '</favicon.ico>; rel=icon; as=image; type=image/x-icon',
          },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
