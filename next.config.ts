import type { NextConfig } from "next";

// Hvem som får vise appen i en iframe.
const frameAncestors =
  process.env.FRAME_ANCESTORS ||
  [
    "'self'",
    "https://smartelektrosol.no",
    "https://*.smartelektrosol.no",
    "https://smartelektro.no",
    "https://*.smartelektro.no",
    "https://*.vercel.app",
    "http://localhost:*",
  ].join(" ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Content-Security-Policy", value: `frame-ancestors ${frameAncestors}` }],
      },
    ];
  },
};

export default nextConfig;
