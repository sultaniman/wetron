import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    react(),
    dts({ include: ["src"], tsconfigPath: "../../tsconfig.build.json", entryRoot: "src" }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: [
        "react",
        "react/jsx-runtime",
        "react-dom",
        "@xyflow/react",
        "@phosphor-icons/react",
        "@wetron/core",
        "@wetron/core/ir",
        "@wetron/core/transform",
        "@wetron/core/edge-path",
        "@wetron/core/panel-utils",
        "@wetron/tokens",
      ],
    },
    sourcemap: true,
    cssCodeSplit: false,
  },
});
