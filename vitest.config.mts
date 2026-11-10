import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Resolves the "@/..." alias from tsconfig.json.
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    // The gate runs locally, so a stray .only must fail here too, not just in CI.
    allowOnly: false,
    include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
  },
});
