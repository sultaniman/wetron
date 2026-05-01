import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      // Don't trigger HMR from workspace package sources — Vite already
      // resolves them through its own pipeline. Changes to these files
      // would otherwise remount the whole React tree and lose loaded-model state.
      ignored: ["**/packages/*/test/**"],
    },
  },
});
