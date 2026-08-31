import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Emits a self-contained server bundle so the Docker runtime stage needs
   * neither node_modules nor the source tree. Required by the Dockerfile
   * (M0-T13).
   */
  output: "standalone",

  /**
   * `better-sqlite3` is a native addon. Bundling it rewrites the `require`
   * that locates its `.node` binary, and the failure surfaces at runtime as
   * a missing-module error inside the package rather than as anything
   * pointing at the bundler. Leaving it external is the supported fix.
   */
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
