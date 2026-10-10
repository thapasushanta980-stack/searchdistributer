import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  ssr: { noExternal: ["@sd/shared"] },
  build: {
    target: "es2022",
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        // Long-lived vendor chunks cache across deploys; app code changes more often.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return "react";
          if (id.includes("framer-motion") || id.includes("motion-dom") || id.includes("motion-utils")) return "motion";
          if (id.includes("@radix-ui") || id.includes("@floating-ui") || id.includes("aria-hidden") || id.includes("react-remove-scroll")) return "radix";
          return undefined;
        },
      },
    },
  },
});
