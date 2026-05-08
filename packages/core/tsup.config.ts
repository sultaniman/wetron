import { defineConfig } from "tsup";

// Pass 1: library modules - no parser deps, parsers import from these
export default defineConfig({
  entry: {
    ir: "src/ir.ts",
    dtypes: "src/dtypes.ts",
    detect: "src/detect.ts",
    transform: "src/transform.ts",
    "edge-path": "src/edge-path.ts",
    "panel-utils": "src/panel-utils.ts",
    flatbuffers: "src/flatbuffers.ts",
    "format-val": "src/format-val.ts",
    "heatmap-color": "src/heatmap-color.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  tsconfig: "../../tsconfig.build.json",
  clean: true,
  external: ["dagre", "flatbuffers"],
});
