import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Emits a self-contained server bundle so the Docker runtime stage needs
   * neither node_modules nor the source tree. Required by the Dockerfile
   * (M0-T13).
   */
  output: "standalone",
};

export default nextConfig;
