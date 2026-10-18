import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: { NODE_ENV: "test", DATABASE_URL: "postgresql://test:test@localhost:1/test", SHOW_DEMO_DATA: "false" },
  },
});
