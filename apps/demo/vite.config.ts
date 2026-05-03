import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    conditions: ["source"],
  },
  server: {
    watch: {
      ignored: ["**/packages/*/test/**", "**/packages/*/dist/**"],
    },
  },
});
