import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  // Workspace package ships TypeScript source, so bundle it; keep real dependencies external.
  noExternal: ["@sd/shared"],
  external: ["vite"],
});
