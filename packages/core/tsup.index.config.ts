import { defineConfig } from "tsup";

// Pass 2: entry point — dynamically imports parsers, runs after parsers are built
export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  tsconfig: "../../tsconfig.build.json",
  clean: false,
  external: ["@wetron/onnx", "@wetron/tflite", "@wetron/keras", "@wetron/executorch", "@wetron/torchscript", "dagre"],
});
