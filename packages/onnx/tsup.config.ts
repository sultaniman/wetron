import { defineConfig } from "tsup";

export default defineConfig({
  entry: { parse: "src/parse.ts" },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  tsconfig: "../../tsconfig.build.json",
  clean: true,
  external: ["@wetron/core"],
});
