#!/usr/bin/env bash
set -euo pipefail

packages=(tokens onnx tflite keras executorch torchscript core react svelte)

for pkg in "${packages[@]}"; do
  echo "Publishing @wetron/$pkg..."
  (cd "packages/$pkg" && npm publish --tag beta --access public)
  echo "✓ @wetron/$pkg"
done

echo "All packages published."
