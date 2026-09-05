import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloud/agent previews often hit the app via proxied hosts.
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "*.cursor.sh",
    "*.cursor.com",
    "*.trycloudflare.com",
  ],
};

export default nextConfig;
