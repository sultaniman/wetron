import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    ir: "src/ir.ts",
    dtypes: "src/dtypes.ts",
    flatbuffers: "src/flatbuffers.ts",
    protobuf: "src/protobuf.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  tsconfig: "../../tsconfig.build.json",
  clean: true,
  external: ["flatbuffers", "protobufjs"],
});
