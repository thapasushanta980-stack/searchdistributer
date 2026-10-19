import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      NODE_ENV: "test",
      // Integration tests run against TEST_DATABASE_URL when it is set; otherwise a dummy URL (DB-free tests only).
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://test:test@localhost:1/test",
      SHOW_DEMO_DATA: "false",
    },
  },
});
