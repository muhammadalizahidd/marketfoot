import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the end-to-end build live beside a running `next dev` without overwriting its .next folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
