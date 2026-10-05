import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["fs", "path", "readline"],
  // Hide the Next.js dev "N" badge (the app shows its own logo instead).
  devIndicators: false,
};

export default nextConfig;
