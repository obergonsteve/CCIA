import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["convex/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 30_000,
  },
});
