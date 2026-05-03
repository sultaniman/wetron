#!/usr/bin/env bash
set -euo pipefail

# Update lockfile so bun resolves workspace:* from current package.json versions
bun install

packages=(tokens onnx tflite keras executorch torchscript core react svelte)

for pkg in "${packages[@]}"; do
  echo "Publishing @wetron/$pkg..."
  (cd "packages/$pkg" && bun publish --access public)
  echo "✓ @wetron/$pkg"
done

echo "All packages published."
