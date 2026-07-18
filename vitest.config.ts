/**
 * Vitest configuration — separate from vite.config.ts (the production build config)
 * to avoid pulling in Cloudflare Workers, TanStack Start, and SSR plugins during tests.
 */
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["src/__tests__/setup.ts"],
    include: ["src/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/domain/**/*.ts", "src/lib/**/*.ts"],
      exclude: ["**/*.d.ts", "**/index.ts"],
    },
    reporters: ["verbose"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
