import { defineConfig } from "tsup";

// Pass 1: library modules - no parser deps, used by other core entry points
export default defineConfig({
  entry: {
    detect: "src/detect.ts",
    transform: "src/transform.ts",
    "edge-path": "src/edge-path.ts",
    "panel-utils": "src/panel-utils.ts",
    "format-val": "src/format-val.ts",
    "heatmap-color": "src/heatmap-color.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  tsconfig: "../../tsconfig.build.json",
  clean: true,
  external: ["@wetron/common", "dagre"],
});
