import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Node environment by default. Component tests that need a DOM opt in
    // per-file with `// @vitest-environment jsdom`.
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Font parsing and PDF rendering are slower than typical unit tests.
    testTimeout: 30_000,
  },
});
