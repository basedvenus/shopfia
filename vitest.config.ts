import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    setupFiles: ["tests/setup/unit.ts"],
    env: {
      DATABASE_URL: "postgresql://unit:unit@127.0.0.1:1/shopfia_test_unit_disabled"
    },
    globals: true
  }
});
