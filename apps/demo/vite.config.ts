import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@wetron/react": resolve(__dirname, "../../packages/react/src/index.ts"),
    },
  },
  server: {
    watch: {
      ignored: ["**/packages/*/test/**"],
    },
  },
});
