import { readFileSync, writeFileSync } from "fs";

const version = process.argv[2];
if (!version) {
  console.error("usage: bun scripts/bump-version.ts <version>");
  process.exit(1);
}

const packages = [
  "packages/core",
  // "packages/onnx",
  // "packages/tflite",
  // "packages/keras",
  // "packages/tokens",
  "packages/executorch",
  "packages/torchscript",
  "packages/react",
  "packages/svelte",
];

for (const dir of packages) {
  const path = `${dir}/package.json`;
  const pkg = JSON.parse(readFileSync(path, "utf8"));
  pkg.version = version;
  writeFileSync(path, JSON.stringify(pkg, null, 2) + "\n");
  console.log(`  ${pkg.name}  ->  ${version}`);
}
