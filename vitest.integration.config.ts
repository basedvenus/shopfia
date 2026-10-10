import path from "node:path";
import { defineConfig } from "vitest/config";
import { requireIntegrationDatabaseUrl } from "./tests/helpers/integration-database";

// Reject unsafe targets before collecting tests or importing application code.
const databaseUrl = requireIntegrationDatabaseUrl(process.env);

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") }
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    env: { DATABASE_URL: databaseUrl },
    fileParallelism: false,
    globals: true
  }
});
