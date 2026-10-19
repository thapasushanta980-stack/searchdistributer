import { defineConfig } from "tsup";

export default defineConfig({
  // Flat output names: the server, plus one-off ops scripts that must run in the production image (no tsx there).
  entry: { index: "src/index.ts", "create-admin": "prisma/create-admin.ts", seed: "prisma/seed.ts" },
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  // Workspace package ships TypeScript source, so bundle it; keep real dependencies external.
  noExternal: ["@sd/shared"],
  external: ["vite"],
});
